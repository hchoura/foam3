/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.nanos.medusa',
  name: 'MedusaConsensusDAO',
  extends: 'foam.dao.ProxyDAO',

  implements: [
    'foam.core.ContextAgent',
    'foam.nanos.NanoService'
  ],

  documentation: `Receive entries from the Nodes.
Test for consensus on hash, promote to mdao, cleanup, and notify.
This is the heart of Medusa.`,

  javaImports: [
    'foam.core.Agency',
    'foam.core.AgencyTimerTask',
    'foam.core.ContextAgent',
    'foam.core.ContextAgentTimerTask',
    'foam.core.FObject',
    'foam.core.X',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.DOP',
    'foam.lib.json.JSONParser',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.COUNT',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.GT',
    'static foam.mlang.MLang.MAX',
    'static foam.mlang.MLang.MIN',
    'static foam.mlang.MLang.OR',
    'foam.mlang.sink.Count',
    'foam.mlang.sink.Max',
    'foam.mlang.sink.Min',
    'foam.nanos.alarming.Alarm',
    'foam.nanos.logger.PrefixLogger',
    'foam.nanos.logger.Logger',
    'foam.nanos.pm.PM',
    'foam.util.SafetyUtil',
    'java.util.Arrays',
    'java.util.ArrayList',
    'java.util.HashMap',
    'java.util.List',
    'java.util.Map',
    'java.util.Timer'
  ],

  axioms: [
    {
      name: 'javaExtras',
      buildJavaClass: function(cls) {
        cls.extras.push(foam.java.Code.create({
          data: `
  protected Object promoterLock_ = new Object();
          `
        }));
      }
    }
  ],

  properties: [
    {
      name: 'timerInterval',
      class: 'Long',
      value: 10000
    },
    {
      name: 'initialTimerDelay',
      class: 'Long',
      value: 10000
    },
    {
      name: 'lastPromotedIndex',
      class: 'Long'
    },
    {
      name: 'logger',
      class: 'FObjectProperty',
      of: 'foam.nanos.logger.Logger',
      visibility: 'HIDDEN',
      transient: true,
      javaCloneProperty: '//noop',
      javaFactory: `
        return new PrefixLogger(new Object[] {
          this.getClass().getSimpleName()
        }, (Logger) getX().get("logger"));
      `
    }
  ],

  methods: [
    {
      name: 'put_',
      javaCode: `
      MedusaEntry entry = (MedusaEntry) obj;
      MedusaEntry existing = null;
      ClusterConfigSupport support = (ClusterConfigSupport) x.get("clusterConfigSupport");
      ReplayingInfo replaying = (ReplayingInfo) x.get("replayingInfo");
      try {
        if ( replaying.getReplaying() ) {
          // getLogger().debug("put", replaying.getIndex(), replaying.getReplayIndex(), entry.toSummary(), "from", entry.getNode());
          if ( entry.getIndex() % 10000 == 0 ) {
            getLogger().info("put", replaying.getIndex(), replaying.getReplayIndex(), entry.toSummary(), "from", entry.getNode());
          }
        }
        if ( replaying.getIndex() > entry.getIndex() ) {
          // getLogger().debug("put", replaying.getIndex(), entry.toSummary(), "from", entry.getNode(), "discarding");
          return entry;
        }

        existing = (MedusaEntry) getDelegate().find_(x, entry.getId());
        if ( existing != null &&
             existing.getPromoted() ) {
          return existing;
        }

        synchronized ( entry.getId().toString().intern() ) {

          existing = (MedusaEntry) getDelegate().find_(x, entry.getId());
          if ( existing != null ) {
            if ( existing.getPromoted() ) {
              return existing;
            }
          } else {
            existing = entry;
          }

          PM pm = PM.create(x, this.getClass().getSimpleName(), "put");

          // NOTE: all this business with the nested Maps to avoid
          // a mulitipart id (index,hash) on MedusaEntry, as presently
          // it is a huge performance impact.
          Map<String, Map> hashes = existing.getConsensusHashes();
          Map<String, Object> nodes = hashes.get(entry.getHash());
          if ( nodes == null ) {
            nodes = new HashMap<String, Object>();
            hashes.put(entry.getHash(), nodes);
          }
          if ( nodes.get(entry.getNode()) == null ) {
            nodes.put(entry.getNode(), entry);
          }
          if ( existing.isFrozen() ) {
            existing = (MedusaEntry) existing.fclone();
          }
          existing.setConsensusHashes(hashes);
          if ( nodes.size() > existing.getConsensusCount() ) {
            existing.setConsensusCount(nodes.size());
            existing.setConsensusNodes(nodes.keySet().toArray(new String[0]));
          }
          existing = (MedusaEntry) getDelegate().put_(x, existing);
          if ( nodes.size() >= support.getNodeQuorum() &&
               existing.getIndex() == replaying.getIndex() + 1 ) {
            existing = promote(x, existing);
          }
          pm.log(x);
        }

        if ( ! existing.getPromoted() &&
             ! replaying.getReplaying() ) {
          synchronized ( promoterLock_ ) {
            promoterLock_.notify();
          }
        }
      } catch ( Throwable t ) {
        getLogger().error(t);
        throw t;
      }
      return existing;
      `
    },
    {
      documentation: `Make an entry available for Dagger hashing.`,
      name: 'promote',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'entry',
          type: 'foam.nanos.medusa.MedusaEntry'
        }
      ],
      type: 'foam.nanos.medusa.MedusaEntry',
      javaCode: `
      // NOTE: implementation expects caller to lock on entry index
      PM pm = PM.create(x, this.getClass().getSimpleName(), "promote");
      ReplayingInfo replaying = (ReplayingInfo) x.get("replayingInfo");
      DaggerService dagger = (DaggerService) x.get("daggerService");

      try {
        synchronized ( entry.getId().toString().intern() ) {
          entry = (MedusaEntry) getDelegate().find_(x, entry.getId());
          if ( entry.getPromoted() ) {
            return entry;
          }
          if ( entry.isFrozen() ) {
            entry = (MedusaEntry) entry.fclone();
          }

          // REVIEW: partial cleanup.
          MedusaEntry.CONSENSUS_HASHES.clear(entry);

          dagger.verify(x, entry);
          if ( ! SafetyUtil.isEmpty(entry.getData()) ) {
            // Only non-transient entries can be used for links,
            // as only non-transient are stored on the nodes.
            dagger.updateLinks(x, entry);
          }

          // test to save a synchronized call
          if ( entry.getIndex() > dagger.getGlobalIndex(x) ) {
            // Required on Secondaries.
            dagger.setGlobalIndex(x, entry.getIndex());
          }

          try {
            entry = mdao(x, entry);
          } catch( IllegalArgumentException e ) {
            // nop - already reported - occurs when a DAO is removed.
          }

          entry.setPromoted(true);
          entry = (MedusaEntry) getDelegate().put_(x, entry);
        }

        // Notify any blocked Primary puts
        MedusaRegistry registry = (MedusaRegistry) x.get("medusaRegistry");
        registry.notify(x, entry);

        replaying.updateIndex(x, entry.getIndex());
        replaying.setNonConsensusIndex(0);
        replaying.setLastModified(new java.util.Date());
        if ( replaying.getReplaying() &&
             replaying.getIndex() >= replaying.getReplayIndex() ) {
          getLogger().info("promote", "replayComplete", replaying.getIndex());
          ((DAO) x.get("localMedusaEntryDAO")).cmd(new ReplayCompleteCmd());
        }
      } finally {
        pm.log(x);
      }
      return entry;
      `
    },
    {
      documentation: 'NanoService implementation.',
      name: 'start',
      javaCode: `
      getLogger().info("start");
      Timer timer = new Timer(this.getClass().getSimpleName());
      timer.schedule(
        new AgencyTimerTask(getX(), this),
        getInitialTimerDelay());
       `
    },
    {
      documentation: 'ContextAgent implementation. Handling out of order consensus updates. Check if next (index + 1) has reach consensus and promote.',
      name: 'execute',
      args: [
        {
          name: 'x',
          type: 'Context'
        }
      ],
      javaCode: `
      ClusterConfigSupport support = (ClusterConfigSupport) x.get("clusterConfigSupport");
      Long nextIndexSince = System.currentTimeMillis();
      Alarm alarm = new Alarm.Builder(x)
        .setName("Medusa Consensus")
        .setClusterable(false)
        .build();
      try {
        while ( true ) {
          ReplayingInfo replaying = (ReplayingInfo) x.get("replayingInfo");
          PM pm = PM.create(x, "MedusaConsensusDAO", "promoter");
          MedusaEntry entry = null;
          try {
            Long nextIndex = replaying.getIndex() + 1;
            if ( replaying.getReplaying() ) {
              if ( nextIndex % 10000 == 0 ) {
                getLogger().info("promoter", "next", nextIndex);
              }
            } else {
               getLogger().debug("promoter", "next", nextIndex);
            }
            MedusaEntry next = (MedusaEntry) getDelegate().find_(x, nextIndex);
            if ( next != null ) {
              if ( next.getPromoted() ) {
                continue;
              }

              entry = getConsensusEntry(x, next);

              if ( entry != null ) {
                entry = promote(x, entry);
                nextIndexSince = System.currentTimeMillis();

                if ( alarm.getIsActive() ) {
                  alarm.setIsActive(false);
                  alarm = (Alarm) ((DAO) x.get("alarmDAO")).put(alarm);
                }
              } else {
                if ( replaying.getNonConsensusIndex() < nextIndex ) {
                  replaying.setNonConsensusIndex(nextIndex);
                  replaying.setLastModified(new java.util.Date());
                }
                // TODO: more thought on alarming, and configuration for alarm times. This is really messy.
                if ( replaying.getReplaying() ) {
                  if ( System.currentTimeMillis() - replaying.getLastModified().getTime() > 60000 ) {
                    getLogger().warning("promoter", "no consensus", next.getConsensusCount(), support.getNodeQuorum(), "since", replaying.getLastModified(), "on", next.toSummary());
                    alarm.setIsActive(true);
                    alarm.setNote("No Consensus: "+next.toSummary());
                    alarm = (Alarm) ((DAO) x.get("alarmDAO")).put(alarm);
                  } else {
                    if ( alarm.getIsActive() ) {
                      alarm.setIsActive(false);
                      alarm = (Alarm) ((DAO) x.get("alarmDAO")).put(alarm);
                    }
                  }
                } else if ( System.currentTimeMillis() - replaying.getLastModified().getTime() > 5000 ) {
                  getLogger().warning("promoter", "no consensus", next.getConsensusCount(), support.getNodeQuorum(), "since", replaying.getLastModified(), "on", next.toSummary());
                  if ( ! alarm.getIsActive() ) {
                    alarm.setIsActive(true);
                    alarm.setNote("No Consensus: "+next.toSummary());
                    alarm = (Alarm) ((DAO) x.get("alarmDAO")).put(alarm);

                    // NOTE: inside the alarm.getIsActive - replay request
                    // will run once per alarm. So to force replay again,
                    // clear the alarm.
                    final ReplayRequestCmd cmd = new ReplayRequestCmd();
                    cmd.setDetails(new ReplayDetailsCmd.Builder(x).setMinIndex(next.getIndex()).build());
                    Agency agency = (Agency) x.get(support.getThreadPoolName());
                    agency.submit(x, new ContextAgent() {
                      public void execute(X x) {
                        ((DAO) x.get("localClusterConfigDAO")).cmd(cmd);
                      }
                    }, this.getClass().getSimpleName());
                  }
                } else {
                  if ( alarm.getIsActive() ) {
                    alarm.setIsActive(false);
                    alarm = (Alarm) ((DAO) x.get("alarmDAO")).put(alarm);
                  }
                }
              }
            }
            if ( next == null ||
                 entry != null &&
                 ! entry.getPromoted() ) {
              gap(x, nextIndex, nextIndexSince);
            }
          } finally {
            pm.log(x);
          }
          if ( entry == null ) {
            try {
              synchronized ( promoterLock_ ) {
                promoterLock_.wait(replaying.getReplaying() ? 500 : getTimerInterval());
              }
            } catch (InterruptedException e ) {
              break;
            }
          }
        }
      } catch ( Throwable e ) {
        getLogger().error("promoter", e.getMessage(), e);
        DAO d = (DAO) x.get("localClusterConfigDAO");
        ClusterConfig config = (ClusterConfig) d.find(support.getConfigId()).fclone();
        config.setErrorMessage(e.getMessage());
        config.setStatus(Status.OFFLINE);
        d.put(config);

        alarm.setIsActive(true);
        alarm.setNote(e.getMessage());
        ((DAO) x.get("alarmDAO")).put(alarm);
      } finally {
        getLogger().warning("promoter", "exit");
      }
     `
    },
    {
      documentation: 'Make an entry available for Dagger hashing.',
      name: 'mdao',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'entry',
          type: 'foam.nanos.medusa.MedusaEntry'
        }
      ],
      type: 'foam.nanos.medusa.MedusaEntry',
      javaCode: `
      PM pm = PM.create(x, this.getClass().getSimpleName(), "mdao");

      try {
        ClusterConfigSupport support = (ClusterConfigSupport) x.get("clusterConfigSupport");
        ClusterConfig config = support.getConfig(x, support.getConfigId());
        ReplayingInfo replaying = (ReplayingInfo) x.get("replayingInfo");
        if ( replaying.getReplaying() ||
             ! config.getIsPrimary() ) {
            // TODO: cache cls for nspecName
            DAO dao = support.getMdao(x, entry.getNSpecName());
            Class cls = null;
            if ( dao instanceof foam.dao.ProxyDAO ) {
              cls = ((foam.dao.ProxyDAO) dao).getOf().getObjClass();
            } else if ( dao instanceof foam.dao.MDAO ) {
              cls = ((foam.dao.MDAO) dao).getOf().getObjClass();
            } else {
              getLogger().error("mdao", entry.getIndex(), entry.getNSpecName(), dao.getClass().getSimpleName(), "Unable to determine class");
              Alarm alarm = new Alarm("Unknown class");
              alarm.setClusterable(false);
              alarm.setNote("Index: "+entry.getIndex()+"\\nNSpec: "+entry.getNSpecName());
              alarm = (Alarm) ((DAO) x.get("alarmDAO")).put(alarm);
              throw new MedusaException("Unknown class");
            }
          FObject nu = null;
          String data = entry.getData();
          if ( ! SafetyUtil.isEmpty(data) ) {
            try {
              nu = x.create(JSONParser.class).parseString(entry.getData(), cls);
            } catch ( RuntimeException e ) {
              Throwable cause = e.getCause();
              while ( cause.getCause() != null ) {
                cause = cause.getCause();
              }
              getLogger().error("mdao", "Failed to parse", entry.getIndex(), entry.getNSpecName(), cls, entry.getData(), e);
              Alarm alarm = new Alarm("Medusa Failed to parse");
              alarm.setSeverity(foam.log.LogLevel.ERROR);
              alarm.setClusterable(false);
              alarm.setNote("Index: "+entry.getIndex()+"\\nNSpec: "+entry.getNSpecName());
              alarm = (Alarm) ((DAO) x.get("alarmDAO")).put(alarm);
              throw new MedusaException("Failed to parse.", cause);
            }
            if ( nu == null ) {
              getLogger().error("mdao", "Failed to parse", entry.getIndex(), entry.getNSpecName(), cls, entry.getData());
              Alarm alarm = new Alarm("Medusa Failed to parse");
              alarm.setSeverity(foam.log.LogLevel.ERROR);
              alarm.setClusterable(false);
              alarm.setNote("Index: "+entry.getIndex()+"\\nNSpec: "+entry.getNSpecName());
              alarm = (Alarm) ((DAO) x.get("alarmDAO")).put(alarm);
              throw new MedusaException("Failed to parse");
            }

            FObject old = dao.find_(x, nu.getProperty("id"));
            if (  old != null ) {
              nu = old.fclone().overlay(nu);
            }
          }
          if ( ! SafetyUtil.isEmpty(entry.getTransientData()) ) {
            FObject tran = x.create(JSONParser.class).parseString(entry.getTransientData(), cls);
            if ( tran == null ) {
              getLogger().error("mdao", "Failed to parse", entry.getIndex(), entry.getNSpecName(), cls, entry.getTransientData());
              Alarm alarm = new Alarm("Medusa Failed to parse (transient)");
              alarm.setClusterable(false);
              alarm.setNote("Index: "+entry.getIndex()+"\\nNSpec: "+entry.getNSpecName());
              alarm = (Alarm) ((DAO) x.get("alarmDAO")).put(alarm);
            } else {
              if ( nu == null ) {
                nu = tran;
                FObject old = dao.find_(x, nu.getProperty("id"));
                if (  old != null ) {
                  nu = old.fclone().overlay(nu);
                }
              } else {
                nu = nu.overlay(tran);
              }
            }
          }
          if ( nu != null ) {
            if ( DOP.PUT == entry.getDop() ) {
              dao.put_(x, nu);
            } else if ( DOP.REMOVE == entry.getDop() ) {
              dao.remove_(x, nu);
            } else {
              getLogger().warning("Unsupported operation", entry.getDop().getLabel());
              throw new UnsupportedOperationException(entry.getDop().getLabel());
            }

            // Secondaries will block on registry
            // NOTE: See PromotedPurgeAgent for Registry cleanup.  These
            // registry.register requests will remain until a 'waiter', or
            // until purged - which is the case for idle Secondaries and
            // non-active Regions.
            if ( ! replaying.getReplaying() &&
                 ! config.getIsPrimary() ) {
              MedusaRegistry registry = (MedusaRegistry) x.get("medusaRegistry");
              registry.register(x, (Long) entry.getId());
            }
          }
        }

        return entry;
      } catch (IllegalArgumentException e) {
        pm.error(x, e);
        throw e;
      } catch (Throwable t) {
        pm.error(x, t);
        getLogger().error(t);
        throw t;
      } finally {
        pm.log(x);
      }
      `
    },
    {
      documentation: 'For an index, get the entry with quorum matching hashes.',
      name: 'getConsensusEntry',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'next',
          type: 'foam.nanos.medusa.MedusaEntry'
        }
      ],
      type: 'foam.nanos.medusa.MedusaEntry',
      javaCode: `
      PM pm = PM.create(x, this.getClass().getSimpleName(), "getConsensusEntry");
      MedusaEntry entry = null;
      try {
        ClusterConfigSupport support = (ClusterConfigSupport) x.get("clusterConfigSupport");
        Map<Object, Map> hashes = next.getConsensusHashes();
        try {
          for ( Map<String, MedusaEntry> nodes : hashes.values() ) {
            if ( nodes.size() >= support.getNodeQuorum() ) {
              if ( entry == null ) {
                for ( MedusaEntry e : nodes.values() ) {
                  entry = e;
                  break;
                }
              } else {
                getLogger().error("getConsensusEntry", next, "Multiple consensus detected", hashes.size(), next.toSummary(), next.getConsensusCount(), support.getNodeQuorum(), next.getConsensusHashes());
                throw new MedusaException("Multiple consensus detected. "+next.toSummary());
              }
            }
          }
        } catch (Throwable t) {
          for ( Map<String, MedusaEntry> nodes : hashes.values() ) {
            for ( Map.Entry me : nodes.entrySet() ) {
              MedusaEntry e = (MedusaEntry) me.getValue();
              getLogger().info(e.getIndex(), e.getHash(), me.getKey());
            }
            throw t;
          }
        }
      } finally {
        pm.log(x);
      }
      return entry;
      `
    },
    {
      documentation: `Test for gap, investigate, attempt recovery.
During replay gaps are treated differently; If the index after the gap is ready for promotion, then promote it. During normal operation gaps are not expected and a wait strategy is invoked.`,
      name: 'gap',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'index',
          type: 'Long'
        },
        {
          documentation: 'milliseconds since epoch at this gap index',
          name: 'since',
          type: 'Long'
        }
      ],
      javaCode: `
// TODO: another scenario - broadcast from primary - but primary dies before broadcasting to quorum of Nodes.  So only x of y nodes have copy.  The entry will not be promoted, and the system will effectively halt.   It is possible to recover from this scenario by deleting the x node entries.

      ReplayingInfo replaying = (ReplayingInfo) x.get("replayingInfo");
      if ( index != replaying.getIndex() + 1 ||
           ! replaying.getReplaying() &&
           System.currentTimeMillis() - since < 2000 ) {
        return;
      }

      // NOTE: use internalMedusaDAO, else we'll block on ReplayingDAO.
      DAO dao = (DAO) x.get("internalMedusaDAO");
      PM pm = PM.create(x, this.getClass().getSimpleName(), "gap");
      try {
        ClusterConfigSupport support = (ClusterConfigSupport) x.get("clusterConfigSupport");
        ClusterConfig config = support.getConfig(x, support.getConfigId());
        MedusaEntry entry = (MedusaEntry) getDelegate().find_(x, index + 1);
        Long minIndex = 0L;
        if ( entry == null ) {
          Min min = (Min) getDelegate().where(
            EQ(MedusaEntry.PROMOTED, false)
          ).select(MIN(MedusaEntry.INDEX));
          if ( min != null &&
               min.getValue() != null &&
              ((Long) min.getValue()) > index ) {
            minIndex = (Long) min.getValue();
            entry = (MedusaEntry) getDelegate().find_(x, minIndex);
          }
        }
        if ( entry != null ) {
          try {
            entry = getConsensusEntry(x, entry);
          } catch ( MedusaException e ) {
            // ignore
          }
          if ( entry != null ) {
            if ( replaying.getReplaying() ) {
              // test if entry depends on any indexes in our skip range.
              long skipRangeLowerBound = index;
              long skipRangeHigherBound = minIndex > 0 ? minIndex-1 : skipRangeLowerBound;
              if ( ( entry.getIndex1() < skipRangeLowerBound || entry.getIndex1() > skipRangeHigherBound ) &&
                    ( entry.getIndex2() < skipRangeLowerBound || entry.getIndex2() > skipRangeHigherBound ) ) {
                // Set global index to next non promoted entry index -1,
                // the promoter will look for the entry after the global index.
                getLogger().info("gap", "skip", index, (minIndex > 0 ? minIndex-1 : ""));
                replaying.updateIndex(x, minIndex > 0 ? minIndex - 1 : index);
              }
              return;
            }
            if ( entry.getIndex() == replaying.getIndex() + 1 ) {
              return;
            }

            getLogger().warning("gap", "found", index);
            String alarmName = "Medusa Gap";
            final Alarm alarm;
            Alarm a = (Alarm) ((DAO) x.get("alarmDAO")).find(AND(EQ(Alarm.NAME, alarmName), EQ(Alarm.HOSTNAME, System.getProperty("hostname", "localhost"))));
            if ( a == null ) {
              alarm = new Alarm(alarmName);
            } else {
              alarm = (Alarm) a.fclone();
            }
            alarm.setClusterable(false);
            alarm.setIsActive(true);
            alarm.setNote("Index: "+index+"\\n"+"Dependencies: UNKNOWN");
            config.setErrorMessage("gap detected, investigating...");
            ((DAO) x.get("clusterConfigDAO")).put(config);
            // Test for gap index dependencies - of course can only look
            // ahead as far as we have entries locally.
            // TODO: Combine these two counts into a sequence.
            Count lookAhead = (Count) dao
              .where(
                  GT(MedusaEntry.INDEX, index)
                )
              .select(COUNT());
            Count dependencies = (Count) dao
              .where(
                OR(
                  EQ(MedusaEntry.INDEX1, index),
                  EQ(MedusaEntry.INDEX2, index)
                ))
              .select(COUNT());
            // REVIEW: This is quick and dirty.
            // look ahead, keep reducing threshold over time
            Long lookAheadThreshold = 10L;
            Long t = (long) (System.currentTimeMillis() - since) / 1000;
            lookAheadThreshold = Math.max(1, lookAheadThreshold - t);
            if ( ((Long)dependencies.getValue()).intValue() == 0 &&
                 ((Long)lookAhead.getValue()).intValue() > lookAheadThreshold ) {
              // Recovery - set global index to the gap index. Then
              // the promoter will look for the entry after the gap.
              getLogger().info("gap", "recovery", index);
              replaying.updateIndex(x, index);
              alarm.setIsActive(false);
              alarm.setNote("Index: "+index+"\\n"+"Dependencies: NO");
              config.setErrorMessage("");
              ((DAO) x.get("clusterConfigDAO")).put(config);
            } else {
              if ( ((Long)lookAhead.getValue()).intValue() > lookAheadThreshold ) {
                getLogger().error("gap", "index", index, "dependencies", dependencies.getValue(), "lookAhead", lookAhead.getValue(), "lookAhead threshold",lookAheadThreshold);
                alarm.setNote("Index: "+index+"\\n"+"Dependencies: YES");
                alarm.setSeverity(foam.log.LogLevel.ERROR);
                config.setErrorMessage("gap with dependencies");
                ((DAO) x.get("clusterConfigDAO")).put(config);
                // throw new MedusaException("gap with dependencies");
              } else {
                getLogger().info("gap", "investigating", index, "dependencies", dependencies.getValue(), "lookAhead", lookAhead.getValue(), "lookAhead threshold",lookAheadThreshold);
              }
            }
            // TODO: do not put, causing deadlock
            // ((DAO) x.get("alarmDAO")).put(alarm);
          }
        }
      } catch (Throwable t) {
        pm.error(x, t);
        getLogger().error(t);
        throw t;
      } finally {
        pm.log(x);
      }
      `
    }
  ]
});

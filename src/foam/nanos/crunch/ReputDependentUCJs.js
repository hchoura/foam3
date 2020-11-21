/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.nanos.crunch',
  name: 'ReputDependentUCJs',

  documentation: `If ucj not granted or in grace_period, then the ucj is in a state where its dependents may need to be updated.
  note: granted ucjs go through SaveUCJDataOnGranted and grace_period is really just an extension of granted.
  `,

  implements: [
    'foam.nanos.ruler.RuleAction'
  ],

  javaImports: [
    'foam.core.ContextAgent',
    'foam.core.X',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.nanos.auth.Subject',
    'foam.nanos.auth.User',
    'java.util.ArrayList',
    'java.util.List',
    'static foam.mlang.MLang.*'
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        agency.submit(x, new ContextAgent() {
          @Override
          public void execute(X x) {
            DAO userCapabilityJunctionDAO = (DAO) x.get("userCapabilityJunctionDAO");
            UserCapabilityJunction ucj = (UserCapabilityJunction) obj;
            UserCapabilityJunction old = (UserCapabilityJunction) userCapabilityJunctionDAO.find(AND(
              EQ(UserCapabilityJunction.SOURCE_ID, ucj.getSourceId()),
              EQ(UserCapabilityJunction.TARGET_ID, ucj.getTargetId())
            ));

            boolean isInvalidate = ucj.getStatus() != CapabilityJunctionStatus.GRANTED || 
              ( ucj.getStatus() == CapabilityJunctionStatus.APPROVED && (
                 old.getStatus() != CapabilityJunctionStatus.APPROVED ||
                 old.getStatus() != CapabilityJunctionStatus.GRANTED ) );
            
            Long effectiveUserId = ( ucj instanceof AgentCapabilityJunction ) ? ((AgentCapabilityJunction) ucj).getEffectiveUser() : null;
            DAO filteredUserCapabilityJunctionDAO = (DAO) userCapabilityJunctionDAO
              .where(OR(
                EQ(UserCapabilityJunction.SOURCE_ID, ucj.getSourceId()),
                EQ(UserCapabilityJunction.SOURCE_ID, effectiveUserId),
                EQ(AgentCapabilityJunction.EFFECTIVE_USER, effectiveUserId)
              ));
            DAO filteredPrerequisiteCapabilityJunctionDAO = (DAO) ((DAO) x.get("prerequisiteCapabilityJunctionDAO"))
              .where(EQ(CapabilityCapabilityJunction.TARGET_ID, ucj.getTargetId()));
            
            List<CapabilityCapabilityJunction> ccjs = ((ArraySink) filteredPrerequisiteCapabilityJunctionDAO
              .select(new ArraySink()))
              .getArray();

            List<UserCapabilityJunction> ucjsToReput = new ArrayList<UserCapabilityJunction>();

            for ( CapabilityCapabilityJunction ccj : ccjs ) {
              UserCapabilityJunction ucjToReput = (UserCapabilityJunction) filteredUserCapabilityJunctionDAO
                .find(EQ(UserCapabilityJunction.TARGET_ID, ccj.getSourceId()));
              if ( ucjToReput != null ) ucjsToReput.add((UserCapabilityJunction) ucjToReput.fclone());
            }

            X effectiveX = x;
            if ( effectiveUserId != null && effectiveUserId > 0 ) {
              DAO userDAO = (DAO) x.get("localUserDAO");
              User effectiveUser = (User) userDAO.find(effectiveUserId);
              Subject subject = (Subject) x.get("subject");
              if ( effectiveUser != null && subject.getUser().getId() != effectiveUser.getId() ) {
                subject = new Subject.Builder(x).setUser(subject.getUser()).build();
                subject.setUser(effectiveUser);
                effectiveX = x.put("subject", subject);
              }
            }

            for ( UserCapabilityJunction ucjToReput : ucjsToReput ) {
              if ( isInvalidate ) ucjToReput.setStatus(cascadeInvalidateStatus(x, ucjToReput, ucj));
              if ( effectiveUserId != null && effectiveX != null &&
                   ucjToReput.getSourceId() == effectiveUserId )
                userCapabilityJunctionDAO.inX(effectiveX).put(ucjToReput);
              else
                userCapabilityJunctionDAO.inX(x).put(ucjToReput);
            }
          }
        }, "Reput the UCJs of dependent capabilities");
      `
    },
    {
      name: 'cascadeInvalidateStatus',
      args: [
        { name: 'x', javaType: 'foam.core.X' },
        { name: 'ucj', javaType: 'foam.nanos.crunch.UserCapabilityJunction' },
        { name: 'prereq', javaType: 'foam.nanos.crunch.UserCapabilityJunction' }
      ],
      javaType: 'foam.nanos.crunch.CapabilityJunctionStatus',
      javaCode: `
        CapabilityJunctionStatus newStatus = ucj.getStatus();

        Capability capability = (Capability) ucj.findTargetId(x);
        boolean reviewRequired = capability.getReviewRequired();
        CapabilityJunctionStatus prereqStatus = prereq.getStatus();

        switch ( (CapabilityJunctionStatus) prereqStatus ) {
          case AVAILABLE : 
            newStatus = CapabilityJunctionStatus.ACTION_REQUIRED;
            break;
          case ACTION_REQUIRED : 
            newStatus = CapabilityJunctionStatus.ACTION_REQUIRED;
            break;
          case PENDING : 
            newStatus = reviewRequired && 
              ( newStatus == CapabilityJunctionStatus.APPROVED || 
                newStatus == CapabilityJunctionStatus.GRANTED
              ) ? 
                CapabilityJunctionStatus.APPROVED : CapabilityJunctionStatus.PENDING;
            break;
          case APPROVED : 
            newStatus = reviewRequired && 
            ( newStatus == CapabilityJunctionStatus.APPROVED || 
              newStatus == CapabilityJunctionStatus.GRANTED
            ) ? 
              CapabilityJunctionStatus.APPROVED : CapabilityJunctionStatus.PENDING;
            break;
          case EXPIRED :
            newStatus = CapabilityJunctionStatus.ACTION_REQUIRED;
            break;
          default : // GRANTED
            if ( prereq.getIsInGracePeriod() ) ucj.setIsInGracePeriod(true);
            if ( prereq.getIsRenewable() ) ucj.setIsRenewable(true);
        }
        return newStatus;

      `
    }
  ]
});
/**
 * NANOPAY CONFIDENTIAL
 *
 * [2021] nanopay Corporation
 * All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of nanopay Corporation.
 * The intellectual and technical concepts contained
 * herein are proprietary to nanopay Corporation
 * and may be covered by Canadian and Foreign Patents, patents
 * in process, and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from nanopay Corporation.
 */

foam.CLASS({
  package: 'net.nanopay.partner.bepay.tx',
  name: 'ScreenUsersOnTransactionCreate',
  extends: 'net.nanopay.meter.compliance.dowJones.AbstractDowJonesComplianceRuleAction',

  documentation: 'Dow Jones screening for payer and payee',

  implements: ['foam.nanos.ruler.RuleAction'],

  javaImports: [
    'foam.core.ContextAgent',
    'foam.core.X',
    'foam.dao.DAO',
    'foam.nanos.auth.Address',
    'foam.nanos.auth.User',
    'foam.nanos.logger.Logger',

    'java.util.Date',

    'net.nanopay.meter.compliance.ComplianceApprovalRequest',
    'net.nanopay.meter.compliance.dowJones.DowJonesResponse',
    'net.nanopay.meter.compliance.dowJones.DowJonesService',
    'net.nanopay.meter.compliance.dowJones.PersonNameSearchData',
    'net.nanopay.tx.model.Transaction',
    'net.nanopay.tx.model.TransactionStatus',
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
      agency.submit(x, new ContextAgent() {
        @Override
        public void execute(X x) {
          Transaction tx = (Transaction) obj;
          User payer = tx.findSourceAccount(x).findOwner(x);
          User payee = tx.findDestinationAccount(x).findOwner(x);
          DowJonesService dowJones = (DowJonesService) x.get("dowJonesService");
          boolean payerSuccess = screenUser(x, payer, dowJones);
          boolean payeeSuccess = screenUser(x, payee, dowJones);
          try {
            if ( payerSuccess && payeeSuccess ) {
              tx.setStatus(TransactionStatus.COMPLETED);
            } else {
              String spid = tx.getSpid();
              String group = spid + "-fraud-ops";
              StringBuilder description = new StringBuilder("Compliance check failed for users: ");
              if ( ! payerSuccess ) description.append("payer - id(").append(payer.getId()).append("),");
              if ( ! payeeSuccess ) description.append("payee - id(").append(payee.getId()).append(")");
              ComplianceApprovalRequest approvalRequest = new ComplianceApprovalRequest.Builder(x)
                .setDaoKey("transactionDAO")
                .setServerDaoKey("localTransactionDAO")
                .setObjId(tx.getId())
                .setGroup(group)
                .setDescription(description.toString())
                .setClassification("Compliance Transaction")
                .build();

              ((DAO) x.get("approvalRequestDAO")).put(approvalRequest);
            }
          } catch (Exception e) {
            Logger logger = (Logger) x.get("logger");
            logger.error("ScreenUsersOnTransactionCreate Error: ", e);
          }
        }
      }, "Create screening for tx payer and payee rule");
      `
    },
    {
      name: 'screenUser',
      type: 'Boolean',
      args: [
        { name: 'x', type: 'Context' },
        { name: 'user', type: 'User' },
        { name: 'dowJones', type: 'DowJonesService' }
      ],
      javaCode: `
      Date filterLRDFrom = fetchLastExecutionDate(x, user.getId(), "Dow Jones User");
      String filterRegion = "";

      Address address = user.getAddress();
      if ( address != null ) {
        if ( address.getCountryId().equals("CA") ) {
          filterRegion = "Canada,CANA,CA,CAN";
        } else if ( address.getCountryId().equals("US") ) {
          filterRegion = "United States,USA,US";
        }
      }
      PersonNameSearchData searchData1 = new PersonNameSearchData.Builder(x)
        .setSearchId(user.getId())
        .setFirstName(user.getFirstName())
        .setFilterLRDFrom(filterLRDFrom)
        .setFilterRegion(filterRegion)
        .setSurName(user.getLastName())
        .build();
      DowJonesResponse response = dowJones.personNameSearch(x, searchData1);
      return response.getTotalMatches() == 0;
      `
    }
  ]
});
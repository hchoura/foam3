/**
 * NANOPAY CONFIDENTIAL
 *
 * [2020] nanopay Corporation
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
  package: 'net.nanopay.tx.rbc',
  name: 'RbcCOTransaction',
  extends: 'net.nanopay.tx.cico.COTransaction',

  implements: [
    'net.nanopay.tx.rbc.RbcTransaction'
  ],

  javaImports: [
    'foam.util.SafetyUtil'
  ],

  properties: [
    {
      name: 'rbcReferenceNumber',
      class: 'String'
    },
    {
      name: 'rbcFileCreationNumber',
      class: 'Long'
    },
    {
      name: 'rejectReason',
      class: 'String'
    },
    {
      name: 'institutionNumber',
      class: 'String',
      value: '003',
      visibility: 'Hidden'
    },
    {
      name: 'settled',
      class: 'Boolean'
    }
  ],
  methods: [
    {
      name: 'limitedCopyFrom',
      args: [
        {
          name: 'other',
          type: 'net.nanopay.tx.model.Transaction'
        },
      ],
      javaCode: `
        super.limitedCopyFrom(other);
        if ( other instanceof RbcCOTransaction ) {
          setRbcReferenceNumber( ((RbcCOTransaction) other).getRbcReferenceNumber() );
          setRbcFileCreationNumber( ((RbcCOTransaction) other).getRbcFileCreationNumber() );
          setRejectReason( ((RbcCOTransaction) other).getRejectReason() );
          setSettled( ((RbcCOTransaction) other).getSettled() );
        }
      `
    },
    {
      name: 'calculateErrorCode',
      javaCode: `
        String reason = getRejectReason();
        if ( SafetyUtil.isEmpty(reason) ) return 0;

        if ( reason.contains("BE16") || reason.contains("RR03") ) {
          return 912l;
        } else if ( reason.contains("BE08")  || reason.contains("BE22") ) {
          return 914l;
        } else if ( reason.contains("RC09") || reason.contains("RC10")  ) {
          return 923l;
        } else {
          return 991l;
        }
      `
    }
  ]
});
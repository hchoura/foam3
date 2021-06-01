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
  package: 'net.nanopay.bank',
  name: 'AccountDetailSummary',

  documentation: 'summary of account informations',

  properties: [
    {
      class: 'String',
      name: 'country'
    },
    {
      class: 'String',
      name: 'currency'
    },
    {
      class: 'String',
      name: 'institutionNumber'
    },
    {
      class: 'String',
      name: 'branchId'
    },
    {
      class: 'String',
      name: 'accountNumber'
    },
    {
      class: 'String',
      name: 'swiftCode'
    },
    {
      class: 'String',
      name: 'iban'
    }
  ],
});
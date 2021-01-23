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

foam.INTERFACE({
  package: 'net.nanopay.tx.errorfee',
  name: 'ErrorBilling',

  documentation: `
    Service interface for retrieving transaction error billing information
  `,

  methods: [
    {
      name: 'getErrorCharge',
      type: 'net.nanopay.tx.errorfee.ErrorCharge',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'transactionId',
          type: 'String'
        }
      ]
    }
  ]
});
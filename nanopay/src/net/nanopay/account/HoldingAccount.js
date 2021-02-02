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
  package: 'net.nanopay.account',
  name: 'HoldingAccount',
  extends: 'net.nanopay.account.DigitalAccount',

  documentation: `
    Digital Holding Account. When an internal user sends money to an external
    user (a contact), we move the money in two transactions instead of one. This
    account acts as the destination account for the first transaction and the
    source account for the second transaction. A holding account is dynamically
    created when the internal wants to pay the invoice before the external user
    is necessarily on the platform to accept the payment. There are two reasons
    we can't simply wait for the external user to join the platform before
    making the transaction:

      1. For FX transactions, most often the payer waits for a good exchange
         rate before paying their international invoices. When they pay an
         invoice, they want the money to be converted immediately so they take
         advantage of the good exchange rate.
      2. When a user pays an invoice, they want the money to leave their account
         so they can't double spend it. This is almost like an escrow account,
         but for now we're not going to truly prevent them from cancelling the
         payment and getting their money back from the intermediary account, so
         in that sense it's not a true escrow account.

    You could argue that if it's not an FX transaction and it's not a real
    escrow account, why bother doing two transactions instead of just one? The
    answer is to make both the user experience and the backend structure and
    logic consistent in both cases.

    It's also important to note the we can only hold digital CAD for legal
    reasons. That means we can't use this type of account as the intermediate
    account for transactions other than CAD to CAD. In any other case we have to
    use an AscendantFX holding account, at least for the time being.
  `,

  properties: [
    {
      class: 'Long',
      name: 'invoiceId',
      documentation: `
        The invoice associated with this account. Each holding account exists
        solely to hold money for a specific invoice to an external user.
      `,
      required: true,
      visibility: 'RO'
    }
  ]
});
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

/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'net.nanopay.tx',
  name: 'NanopayTransactionFeeDAO',
  extends: 'foam.dao.ProxyDAO',

  documentation: ``,

  javaImports: [
    'foam.nanos.logger.Logger',
    'foam.dao.DAO',
    'foam.dao.ArraySink',
    'foam.mlang.MLang',

    'net.nanopay.tx.model.TransactionFee',

    'java.util.List',
    'foam.util.SafetyUtil'
  ],

  properties: [
  ],

  methods: [
    {
      name: 'put_',
      javaCode: `
      Logger logger = (Logger) x.get("logger");
      TransactionQuote quote = (TransactionQuote) getDelegate().put_(x, obj);

      for ( int i = 0; i < quote.getPlans().length; i++ ) {
        quote.getPlans()[i] = applyFees(x, quote.getPlans()[i], quote.getPlans()[i]);
      }
      return quote;
`
    },
    {
      name: 'applyFees',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'transaction',
          type: 'net.nanopay.tx.model.Transaction'
        },
        {
          name: 'applyTo',
          type: 'net.nanopay.tx.model.Transaction'
        }
     ],
      type: 'net.nanopay.tx.model.Transaction',
      javaCode: `
      Logger logger = (Logger) x.get("logger");
      if ( transaction == null ) {
        return transaction;
      }
        DAO transactionFeeDAO = (DAO) x.get("transactionFeeDAO");
        List applicableFees = ((ArraySink) transactionFeeDAO
            .where(
              MLang.AND(
                MLang.OR(
                  MLang.EQ(TransactionFee.TRANSACTION_NAME, transaction.getName()),
                  MLang.EQ(TransactionFee.TRANSACTION_TYPE, transaction.getType())
                ),
                MLang.OR(
                  // TODO: combine with senderPayFees
                  MLang.AND(
                    MLang.EQ(TransactionFee.DENOMINATION, transaction.getSourceCurrency()),

                    MLang.GTE(transaction.getAmount(), TransactionFee.MIN_AMOUNT),
                    MLang.LTE(transaction.getAmount(), TransactionFee.MAX_AMOUNT)
                  ),
                  MLang.AND(
                    MLang.EQ(TransactionFee.DENOMINATION, transaction.getDestinationCurrency()),
                    MLang.GTE(transaction.getDestinationAmount(), TransactionFee.MIN_AMOUNT),
                    MLang.LTE(transaction.getDestinationAmount(), TransactionFee.MAX_AMOUNT)
                  )
                )
              )
            )
            .select(new ArraySink())).getArray();

          if ( applicableFees.size() > 0 ) {
            for (Object applicableFee : applicableFees) {
              TransactionFee fee = (TransactionFee) applicableFee;
              if ( fee.getFee().getIsPassThroughFee() ) {
                continue;
              }
              String feeAccount = fee.getFeeAccount();
              if ( ! SafetyUtil.isEmpty(feeAccount) ) {
                String debit = fee.getSourcePaysFees() ? transaction.getSourceAccount() : transaction.getDestinationAccount();

                FeeLineItem[] forward = new FeeLineItem [] {
                  new FeeLineItem.Builder(x).setNote(fee.getName()).setDestinationAccount(feeAccount).setAmount(fee.getFee().getFee(transaction)).setSourceAccount(debit).build()
                };
                InfoLineItem[] reverse = new InfoLineItem [] {
                  new InfoLineItem.Builder(x).setNote(fee.getName()+" - Non-refundable").setAmount(fee.getFee().getFee(transaction)).build()
                };
                applyTo.addLineItems(forward);
                logger.debug(this.getClass().getSimpleName(), "applyFees", "forward", forward[0], "reverse", reverse[0], "transaction", transaction);
              }
            }
          } else {
            logger.debug(this.getClass().getSimpleName(), "applyFees", "no applicable fees found for transaction", transaction, "type", transaction.getType(), "amount", transaction.getAmount());
          }
          return applyTo;
    `
    },
  ]
});
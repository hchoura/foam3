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
  package: 'net.nanopay.bank',
  name: 'CABankAccount',
  label: 'Canada',
  extends: 'net.nanopay.bank.BankAccount',

  imports: [
    'notify',
    'padCaptureDAO',
    'stack',
    'subject'
  ],

  requires: [
    'foam.log.LogLevel'
  ],

  javaImports: [
    'foam.nanos.iban.ValidationIBAN',
    'foam.nanos.iban.IBANInfo',
    'foam.util.SafetyUtil',
    'java.util.regex.Pattern',
    'net.nanopay.model.Branch',
    'net.nanopay.payment.Institution'
  ],

  documentation: 'Canadian Bank account information.',

  constants: [
    {
      name: 'ACCOUNT_NUMBER_PATTERN',
      type: 'Regex',
      javaValue: 'Pattern.compile("^[0-9]{5,12}$")'
    },
    {
      name: 'BRANCH_ID_PATTERN',
      type: 'Regex',
      javaValue: 'Pattern.compile("^[0-9]{5}$")'
    },
    {
      name: 'INSTITUTION_NUMBER_PATTERN',
      type: 'Regex',
      javaValue: 'Pattern.compile("^[0-9]{3}$")'
    }
  ],

  sections: [
    {
      name: 'accountInformation',
      title: function() {
        return this.forContact ? '' : this.SECTION_DETAILS_TITLE_VOID;
      }
    },
    {
      name: 'pad',
      title: `Connect using a void check`,
      subTitle: `Connect to your account without signing in to online banking.
          Please ensure your details are entered properly.`,
      isAvailable: function(forContact) {
        return ! forContact;
      }
    }
  ],

  messages: [
    { name: 'TRANSIT_NUMBER_REQUIRED', message: 'Transit number required' },
    { name: 'TRANSIT_NUMBER_FORMAT', message: 'Transit number must contain numbers' },
    { name: 'TRANSIT_NUMBER_FIVE', message: 'Transit number must be 5 digits long' },
    { name: 'ACCOUNT_NUMBER_REQUIRED', message: 'Account number required' },
    { name: 'ACCOUNT_NUMBER_INVALID', message: 'Account number must be between 5 and 12 digits long' },
    { name: 'INSTITUTION_NUMBER_REQUIRED', message: 'Institution required' },
    { name: 'INSTITUTION_NUMBER_THREE', message: 'Institution number must be 3 digits long' },
    { name: 'ADD_SUCCESSFUL', message: 'Bank Account successfully added' },
    { name: 'SECTION_DETAILS_TITLE_VOID', message: 'Connect using a void check' }
  ],

  properties: [
    {
      name: 'country',
      value: 'CA',
      section: 'accountInformation',
      visibility: 'RO'
    },
    {
      name: 'flagImage',
      section: 'accountInformation',
      label: '',
      value: 'images/flags/cad.png',
      visibility: 'RO'
    },
    {
      name: 'denomination',
      section: 'accountInformation',
      gridColumns: 12,
      value: 'CAD',
    },
    {
      name: 'iban',
      visibility: 'HIDDEN',
      required: false,
      getter: function() {
        return this.accountNumber;
      },
      javaGetter: `
        return getAccountNumber();
      `,
      validateObj: function(iban) {
      }
    },
    {
      name: 'voidChequeImage',
      class: 'String',
      label: '',
      value: 'images/Canada-Check3.svg',
      section: 'accountInformation',
      visibility: 'RO',
      transient: true,
      view: function(_, X) {
        return {
          class: 'foam.u2.tag.Image',
          displayWidth: '100%'
        };
      },
    },
    {
      name: 'desc',
      visibility: 'HIDDEN'
    },
    {
      name: 'branchId',
      type: 'String',
      label: 'Transit',
      section: 'accountInformation',
      updateVisibility: 'RO',
      createVisibility: 'RW',
      gridColumns: 4,
      view: {
        class: 'foam.u2.tag.Input',
        onKey: true
      },
      preSet: function(o, n) {
        if ( n === '' ) return n;
        return /^\d+$/.test(n) ? n : o;
      },
      postSet: function(o, n) {
        this.padCapture.branchId = n;
      },
      validateObj: function(branchId, branch) {
        if ( branch ) {
          return;
        }
        if ( branchId === '' ) {
          return this.TRANSIT_NUMBER_REQUIRED;
        } else if ( ! /^\d+$/.test(branchId) ) {
          return this.TRANSIT_NUMBER_FORMAT;
        } else if ( branchId.length !== 5 ) {
          return this.TRANSIT_NUMBER_FIVE;
        }
      }
    },
    {
      name: 'institutionNumber',
      label: 'Institution',
      documentation: `Provides backward compatibilty for mobile call flow.
          BankAccountInstitutionDAO will lookup the institutionNumber and set the institution property.`,
      updateVisibility: 'RO',
      createVisibility: 'RW',
      section: 'accountInformation',
      storageTransient: true,
      gridColumns: 3,
      view: {
        class: 'foam.u2.tag.Input',
        maxLength: 3,
        onKey: true
      },
      validateObj: function(institutionNumber) {
        if ( institutionNumber === '' ) {
          return this.INSTITUTION_NUMBER_REQUIRED;
        }
        var instNumberRegex = /^[0-9]{3}$/;
        if ( ! instNumberRegex.test(institutionNumber) ) {
          return this.INSTITUTION_NUMBER_THREE;
        }
      },
      preSet: function(o, n) {
        if ( n === '' ) return n;
        var reg = /^\d+$/;
        return reg.test(n) ? n : o;
      },
      postSet: function(o, n) {
        this.padCapture.institutionNumber = n;
      },
    },
    {
      name: 'accountNumber',
      label: 'Account',
      updateVisibility: 'RO',
      section: 'accountInformation',
      gridColumns: 5,
      view: {
        class: 'foam.u2.tag.Input',
        onKey: true
      },
      postSet: function(o, n) {
        this.padCapture.accountNumber = n;
      },
      validateObj: function(accountNumber) {
        if ( accountNumber === '' ) {
          return this.ACCOUNT_NUMBER_REQUIRED;
        }
        var accNumberRegex = /^[0-9]{5,12}$/;
        if ( ! accNumberRegex.test(accountNumber) ) {
          return this.ACCOUNT_NUMBER_INVALID;
        }
      },
    },
    {
      class: 'String',
      name: 'summary',
      transient: true,
      documentation: `
        Used to display a lot of information in a visually compact way in table
        views of BankAccounts.
      `,
      tableCellFormatter: function(_, obj) {
        this.start()
          .add(obj.slot((institution, institutionDAO) => {
            return institutionDAO.find(institution).then((result) => {
              if ( result && ! net.nanopay.bank.USBankAccount.isInstance(obj) ) {
                return this.E()
                  .start('span').style({ 'font-weight': '500', 'white-space': 'pre' })
                    .add(`${obj.cls_.getAxiomByName('institution').label} `)
                  .end()
                  .start('span').add(`${result.name} |`).end();
              }
            });
          }))
        .end()
        .start()
          .add(obj.slot((branch, branchDAO) => {
            return branchDAO.find(branch).then((result) => {
              if ( result ) {
                return this.E()
                  .start('span').style({ 'font-weight': '500', 'white-space': 'pre' }).add(` ${obj.cls_.getAxiomByName('branch').label}`).end()
                  .start('span').add(` ${result.branchId} |`).end();
              }
            });
          }))
        .end()
        .start()
          .add(obj.slot((accountNumber) => {
              if ( accountNumber ) {
                return this.E()
                  .start('span').style({ 'font-weight' : '500', 'white-space': 'pre' }).add(` ${obj.cls_.getAxiomByName('accountNumber').label} `).end()
                  .start('span').add(`*** ${accountNumber.substring(accountNumber.length - 4, accountNumber.length)}`).end();
              }
          }))
        .end();
      }
    },
    {
      class: 'FObjectProperty',
      of: 'net.nanopay.model.CAPadCapture',
      name: 'padCapture',
      section: 'pad',
      transient: true,
      label: '',
      updateVisibility: 'HIDDEN',
      factory: function() {
        return net.nanopay.model.CAPadCapture.create({
          country: this.country,
          firstName: this.subject.realUser.firstName,
          lastName: this.subject.realUser.lastName,
          companyName: this.subject.user.organization || this.subject.user.businessName,
          address: this.subject.user.address
        }, this);
      },
      view: function(_, X) {
        return foam.u2.MultiView.create({
          views: [
            {
              class: 'foam.u2.view.FObjectView',
              of: 'net.nanopay.model.CAPadCapture'
            },
            {
              // displays ca bank account capabilities
              class: 'foam.nanos.crunch.ui.CapableView',
              capableObj: X.data.padCapture
            }
          ]
        }, X);
      }
    },
    {
      name: 'swiftCode',
      label: 'SWIFT/BIC',
      updateVisibility: 'RO',
      section: 'accountInformation',
      validateObj: function(swiftCode) {
      }
    }
  ],
  methods: [
    async function save(stack_back) {
      try {
        await this.padCaptureDAO.put(this.padCapture);
        this.address = this.padCapture.address;
        await this.subject.user.accounts.put(this);
        if ( this.stack && stack_back ) this.stack.back();
        this.notify(this.ADD_SUCCESSFUL, '', this.LogLevel.INFO, true);
      } catch (error) {
        this.notify(error.message, '', this.LogLevel.ERROR, true);
      }
    },
    {
      name: 'getBankCode',
      type: 'String',
      args: [
        {
          name: 'x', type: 'Context'
        }
      ],
      javaCode: `
        StringBuilder code = new StringBuilder();
        Institution institution = findInstitution(x);
        if ( institution != null ) {
          code.append(institution.getInstitutionNumber());
        }
        return code.toString();
      `
    },
    {
      name: 'validate',
      args: [
        {
          name: 'x', type: 'Context'
        }
      ],
      type: 'Void',
      javaThrows: ['IllegalStateException'],
      javaCode: `
        super.validate(x);
        validateAccountNumber();
        validateInstitutionNumber(x);
        validateBranchId(x);
      `
    },
    {
      name: 'validateAccountNumber',
      type: 'Void',
      javaThrows: ['IllegalStateException'],
      javaCode: `
      String accountNumber = this.getAccountNumber();

      if ( SafetyUtil.isEmpty(accountNumber) ) {
        throw new IllegalStateException(this.ACCOUNT_NUMBER_REQUIRED);
      }
      if ( ! ACCOUNT_NUMBER_PATTERN.matcher(accountNumber).matches() ) {
        throw new IllegalStateException(this.ACCOUNT_NUMBER_INVALID);
      }
      `
    },
    {
      name: 'validateInstitutionNumber',
      args: [
        {
          name: 'x', type: 'Context'
        }
      ],
      type: 'Void',
      javaThrows: ['IllegalStateException'],
      javaCode: `
      Branch branch = this.findBranch(x);
      if ( branch != null &&
          branch.getInstitution() > 0 ) {
        return;
      }

      Institution institution = this.findInstitution(x);

      // no validation when the institution is attached.
      if ( institution != null ) {
        return;
      }

      // when the institutionNumber is provided and not the institution
      String institutionNumber = this.getInstitutionNumber();
      if ( SafetyUtil.isEmpty(institutionNumber) ) {
        throw new IllegalStateException(this.INSTITUTION_NUMBER_REQUIRED);
      }
      if ( ! INSTITUTION_NUMBER_PATTERN.matcher(institutionNumber).matches() ) {
        throw new IllegalStateException(this.INSTITUTION_NUMBER_THREE);
      }
      `
    },
    {
      name: 'validateBranchId',
      args: [
        {
          name: 'x', type: 'Context'
        }
      ],
      type: 'Void',
      javaThrows: ['IllegalStateException'],
      javaCode: `
      Branch branch = this.findBranch(x);

      // no validation when the branch is attached.
      if (branch != null) {
        return;
      }
      // when the branchId is provided and not the branch
      String branchId = this.getBranchId();
      if ( SafetyUtil.isEmpty(branchId) ) {
        throw new IllegalStateException(this.TRANSIT_NUMBER_REQUIRED);
      }
      if ( ! BRANCH_ID_PATTERN.matcher(branchId).matches() ) {
        throw new IllegalStateException(this.TRANSIT_NUMBER_FIVE);
      }
      `
    },
    {
      name: 'getRoutingCode',
      type: 'String',
      args: [
        {
          name: 'x', type: 'Context'
        }
      ],
      javaCode: `
        StringBuilder code = new StringBuilder();
        Branch branch = findBranch(x);
        if ( branch != null ) {
          code.append(branch.getBranchId());
        }
        return code.toString();
      `
    }
  ]
});
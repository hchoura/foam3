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
  package: 'net.nanopay.meter.compliance.identityMind',
  name: 'IdentityMindResponse',

  implements: [
    'foam.nanos.auth.CreatedAware'
  ],

  tableColumns: [
    'id',
    'entityId',
    'apiName',
    'frp',
    'res'
  ],

  javaImports: [
    'foam.util.SafetyUtil',
    'net.nanopay.meter.compliance.ComplianceValidationStatus'
  ],

  properties: [
    {
      class: 'Long',
      name: 'id',
      tableWidth: 50
    },
    {
      class: 'String',
      name: 'entityType'
    },
    {
      class: 'String',
      name: 'daoKey',
      documentation: 'Name of DAO that contains the entity (eg. userDAO)'
    },
    {
      class: 'Object',
      name: 'entityId',
      tableWidth: 100
    },
    {
      class: 'Int',
      name: 'statusCode',
      tableWidth: 80
    },
    {
      class: 'DateTime',
      name: 'created',
      visibility: 'RO'
    },
    {
      class: 'String',
      name: 'apiName',
      documentation: 'The name of the IdentityMind API that was requested.'
    },
    {
      class: 'String',
      name: 'requestJson',
      view: {
        class: 'io.c9.ace.Editor',
        config: {
          width: 600, height: 200,
          mode: 'JSON',
          isReadOnly: true
        }
      }
    },
    {
      class: 'String',
      name: 'error_message'
    },
    {
      class: 'String',
      name: 'user',
      documentation: 'Current reputation of the user.',
      label: 'User reputation'
    },
    {
      class: 'String',
      name: 'upr',
      documentation: 'Previous reputation of the user.',
      label: 'Previous reputation'
    },
    {
      class: 'String',
      name: 'frn',
      documentation: 'Name of the fraud rule that fired.',
      label: 'Fraud rule name'
    },
    {
      class: 'String',
      name: 'frp',
      documentation: 'Result of fraud evaluation.',
      label: 'Fraud evaluation result'
    },
    {
      class: 'String',
      name: 'frd',
      documentation: 'Description of the fraud rule that fired.',
      label: 'Fraud rule description'
    },
    {
      class: 'String',
      name: 'arpr',
      documentation: 'Result of automated review evaluation.',
      label: 'Automated review'
    },
    {
      class: 'String',
      name: 'arpd',
      documentation: 'Description of the automated review rule that fired.',
      label: 'Automated review rule description'
    },
    {
      class: 'String',
      name: 'arpid',
      documentation: 'Id of the automated review rule that fired.',
      label: 'Automated review rule id'
    },
    {
      class: 'String',
      name: 'tid',
      documentation: 'Current transaction id.',
      label: 'IDM transaction id'
    },
    {
      class: 'String',
      name: 'erd',
      documentation: `Description of the reason for the user's reputation.`,
      label: 'User reputation description'
    },
    {
      class: 'String',
      name: 'res',
      documentation: 'Result of policy evaluation. Combines the result of fraud and automated review evaluations.',
      label: 'Result of policy evaluation'
    },
    {
      class: 'String',
      name: 'rcd',
      documentation: 'The set of result codes from the evaluation of the current transaction.',
      label: 'Result codes'
    },
    {
      class: 'FObjectProperty',
      of: 'net.nanopay.meter.compliance.identityMind.IdentityMindResponseEDNA',
      name: 'ednaScoreCard',
      label: 'eDNA Score Card'
    }
  ],

  methods: [
    {
      name: 'getComplianceValidationStatus',
      type: 'net.nanopay.meter.compliance.ComplianceValidationStatus',
      javaCode: `
        String result = ! SafetyUtil.isEmpty(getRes()) ? getRes() : getFrp();
        switch (result) {
          case "ACCEPT":
            return ComplianceValidationStatus.VALIDATED;
          case "DENY":
            return ComplianceValidationStatus.REJECTED;
          case "MANUAL_REVIEW":
            return ComplianceValidationStatus.INVESTIGATING;
          default:
            return null;
        }
      `
    }
  ]
});
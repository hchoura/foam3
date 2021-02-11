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
  package: 'net.nanopay.crunch.registration.businesstypes',
  name: 'NonprofitData',
  extends: 'net.nanopay.crunch.registration.businesstypes.BusinessTypeData',

  documentation: `This model represents the nonprofit or charitable organization business type of a business.`,

  javaImports: [
    'net.nanopay.model.BusinessType'
  ],
  
  properties: [
    ['businessTypeId', 4]
  ]
});
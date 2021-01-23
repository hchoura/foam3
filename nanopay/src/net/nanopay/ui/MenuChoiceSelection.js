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
  package: 'net.nanopay.ui',
  name: 'MenuChoiceSelection',
  extends: 'foam.u2.View',

  documentation: `Selection view for menu RichChoiceViews`,

  properties: [
    {
      name: 'data',
      documentation: 'The selected object.'
    },
    'fullObject',
  ],

  methods: [
    function initE() {
      let display = 'Menu selector';

      if ( this.fullObject !== undefined ) {
        display = this.fullObject.label;
      }

      return this
        .start()
          .add(display)
        .end();
    }
  ]
});
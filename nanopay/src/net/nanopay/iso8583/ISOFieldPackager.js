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
  package: 'net.nanopay.iso8583',
  name: 'ISOFieldPackager',

  documentation: `
    FieldPackager interface to determine how to pack a specific field of an ISO 8583 message
  `,

  methods: [
    {
      name: 'createComponent',
      documentation: 'Creates a new ISO 8583 Component',
      type: 'net.nanopay.iso8583.ISOComponent',
      args: [
        {
          name: 'fieldNumber',
          type: 'Integer'
        }
      ]
    },
    {
      name: 'pack',
      documentation: 'Packs an ISO 8583 component into the OutputStream',
      type: 'Void',
      javaThrows: [
        'java.io.IOException'
      ],
      args: [
        {
          name: 'c',
          type: 'net.nanopay.iso8583.ISOComponent'
        },
        {
          name: 'out',
          javaType: 'java.io.OutputStream'
        }
      ]
    },
    {
      name: 'unpack',
      documentation: 'Unpacks an ISO 8583 component from an InputStream',
      type: 'Void',
      javaThrows: [
        'java.io.IOException'
      ],
      args: [
        {
          name: 'c',
          type: 'net.nanopay.iso8583.ISOComponent'
        },
        {
          name: 'in',
          javaType: 'java.io.InputStream'
        }
      ]
    }
  ]
});
/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.detail',
  name: 'SectionedDetailPropertyView',
  extends: 'foam.u2.View',

  documentation: 'View for one property of a SectionedDetailView.',

  css: `
    ^ {
      /* Add for fixing UI issue in Safari */
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(0,1fr));
    }

    ^validation-container {
      margin-top: 6px;
    }

    ^helper-icon {
      cursor: pointer;
      float: right;
      padding-left: 12px;
      user-select: none;
      -moz-user-select: none;
      -webkit-user-select: none;
    }

    ^tooltip {
      align-self: center;
      position: relative;
    }

    ^tooltip-container {
      z-index: -1;
      display: none;
      width: 80%;
      height: auto;
      line-height: 1.5;
      margin-right: 3px;
    }

    ^arrow-right {
      width: 0;
      height: 0;
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      border-left:10px solid rgba(0, 0, 0, 0.8);
    }

    ^tooltip:hover .foam-u2-detail-SectionedDetailPropertyView-tooltip-container{
      position: absolute;
      display: flex;
      justify-content: flex-end;

      top: 0;
      right: 25px;
      width: 380px;
      z-index: 10;
    }

    ^error .foam-u2-tag-TextArea,
    ^error .foam-u2-tag-Select,
    ^error .foam-u2-TextField,
    ^error .foam-u2-IntView,
    ^error .foam-u2-FloatView,
    ^error .foam-u2-DateView,
    ^error .foam-u2-CurrencyView,
    ^error .foam-u2-view-date-DateTimePicker .date-display-box,
    ^error .foam-u2-view-RichChoiceView-selection-view,
    ^error .foam-u2-view-RichChoiceView-clear-btn
    {
      border-color: /*%DESTRUCTIVE3%*/ #d9170e;
    }

    /*
      !IMPORTANT!
      For the following inputs below, we are planning
      encode these changes in the actual foam files
    */

    ^ .foam-u2-TextField,
    ^ .foam-u2-tag-Select,
    ^ .foam-u2-tag-TextArea,
    ^ .foam-u2-IntView {
      width: 100%;
    }

    ^ .foam-u2-view-date-DateTimePicker {
      cursor: pointer;
    }

    ^ .foam-u2-view-RichChoiceView {
      display: flex;
    }

    ^ .foam-u2-view-RichChoiceView-chevron {
      content: '▾';
      padding-left: 0px;
      font-size: 16px;
      color: #8D9090;
    }

    ^ .foam-u2-view-RichChoiceView-selection-view {
      width: 100%;
      border-radius: 3px;
      background-color: #ffffff;
      box-sizing: border-box;
      -webkit-appearance: none;
      cursor: pointer;
      font-size: 14px;
    }

    ^ .foam-u2-view-RichChoiceView .search {
      padding: 8px 16px;
      font-size: 14px;
      border-bottom: 1px solid #f4f4f9;
    }

    ^ .foam-u2-detail-SectionedDetailPropertyView .property-filter {
      font-size: 14px;
      padding-left: 16px;
    }

    ^ .foam-u2-view-RichChoiceView .search input {
      border-bottom: none;
    }

    ^ .foam-u2-view-RichChoiceView .search img {
      top: 8px;
    }

    ^ .foam-u2-view-RichChoiceView-heading {
      border-bottom: 1px solid #f4f4f9;
      line-height: 24px;
      font-size: 14px;
      color: #333;
      font-weight: 900;
      padding: 6px 16px;
    }

    ^ .foam-u2-view-RichChoiceView-container {
      z-index: 1000;
    }

    ^ .DefaultRowView-row {
      background: white;
      padding: 8px 16px;
      font-size: 12px;
      color: #424242;
    }

    ^ .DefaultRowView-row:hover {
      background: #f4f4f9;
      cursor: pointer;
    }

    ^ .foam-u2-CheckBox-label {
      word-break: break-word;
      white-space: normal;
      margin-top: 6px;
    }

    ^ .foam-u2-layout-Cols {
      padding-bottom: 4px;
      display: flex;
      align-items: center;
    }

  `,

  requires: [
    'foam.core.ConstantSlot',
    'foam.core.ProxySlot',
    'foam.u2.layout.Cols',
    'foam.u2.layout.Rows',
    'foam.u2.ControllerMode',
    'foam.u2.DisplayMode',
    'foam.u2.borders.ExpandableBorder',
    'foam.u2.tag.CircleIndicator'
  ],

  imports: [ 'theme?' ],

  properties: [
    'prop',
    ['helpEnabled', false]
  ],

  messages: [
    { name: 'HELP',       message: 'Help' },
    { name: 'LEARN_MORE', message: 'Click to learn more' }
  ],

  methods: [
    function render() {
      var self = this;
      this.SUPER();

      this.onDetach(this.mode$.follow(self.prop.createVisibilityFor(self.data$, self.controllerMode$)));

      this
        .addClass(this.myClass())
        .addClass(`sectioned-detail-property-${this.prop.name}`)
        .add(this.slot(function(mode, prop, prop$label) {

          var errorSlot = prop.validateObj && prop.validationTextVisible ?
            this.data.slot(prop.validateObj) :
            foam.core.ConstantSlot.create({ value: null });

          return self.E()
            .addClass(this.myClass('wrapper'))
            .start()
              .start(self.Rows)
                .callIf(prop$label, function() {
                  this.start()
                    .addClass('p-semiBold')
                    .add(prop.label)
                    .style({ 'line-height': '2' })
                  .end();
                })
                .start()
                  .style({ 'position': 'relative', 'display': 'flex', 'flex-wrap': 'wrap', 'width': '100%' })
                  .start()
                    .style({ 'flex-grow': 1, 'max-width': '100%' })
                    .tag(prop, { mode$: self.mode$ })
                    .callIf(prop.validationStyleEnabled, function() {
                      this.enableClass(self.myClass('error'), errorSlot);
                    })
                  .end()
                  .callIf(prop.help, function() {
                    this.start().addClass(self.myClass('helper-icon'))
                      .start('', { tooltip: self.LEARN_MORE })
                        .start(self.CircleIndicator, {
                          icon: self.theme ? self.theme.glyphs.helpIcon.getDataUrl({ fill: self.theme.black }) : '/images/question-icon.svg',
                          size: 20
                        })
                          .on('click', () => { self.helpEnabled = ! self.helpEnabled; })
                        .end()
                      .end()
                    .end();
                  })
                .end()
                .callIf(prop.validationTextVisible && ( mode === self.DisplayMode.RW || mode === self.DisplayMode.DISABLED ), function() {
                  this
                    .start()
                      .style({ 'align-items': 'center' })
                      .start(self.Cols)
                        .addClass(self.myClass('validation-container'))
                        .show(errorSlot)
                        .start({
                          class: 'foam.u2.tag.Image',
                          data: '/images/inline-error-icon.svg',
                          displayHeight: '16px',
                          displayWidth: '16px'
                        })
                          .style({
                            'justify-content': 'flex-start',
                            margin: '0 8px 0 0'
                          })
                        .end()
                        .start()
                          .style({ 'flex-grow': 1 })
                          .add(errorSlot.map(s => {
                            return self.E().add(s);
                          }))
                        .end()
                      .end()
                    .end();
                })
              .end()
              .callIf(prop.help, function() {
                this
                  .start(self.ExpandableBorder, { expanded$: self.helpEnabled$, title: self.HELP })
                    .style({ 'flex-basis': '100%', 'margin-top': '8px', width: '100%' })
                    .start('p').add(prop.help).end()
                  .end();
              })
            .end();
        }));
    }
  ]
});

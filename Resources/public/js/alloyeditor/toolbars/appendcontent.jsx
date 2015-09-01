/*
 * Copyright (C) eZ Systems AS. All rights reserved.
 * For full copyright and license information view LICENSE file distributed with this source code.
 */
YUI.add('ez-alloyeditor-toolbar-appendcontent', function (Y) {
    "use strict";

    var AlloyEditor = Y.eZ.AlloyEditor,
        React = Y.eZ.React,
        ToolbarAppendContent;

    /**
     * The ToolbarAppendContent is a toolbar displayed when the user clicks on the
     * add content button.
     *
     * @uses AlloyEditor.WidgetExclusive
     * @uses AlloyEditor.WidgetDropdown
     * @uses AlloyEditor.WidgetFocusManager
     * @uses AlloyEditor.ToolbarButtons
     *
     * @class eZ.AlloyEditor.ToolbarAppendContent
     */
    ToolbarAppendContent = React.createClass({
        mixins: [
            AlloyEditor.WidgetExclusive,
            AlloyEditor.WidgetDropdown,
            AlloyEditor.WidgetFocusManager,
            AlloyEditor.ToolbarButtons,
        ],

        statics: {
            key: 'ezappendcontent'
        },

        propTypes: {
            /**
             * Holds the configuration for the appendcontent toolbar. It must
             * contain a property `addContentButtonClass` with a string. If
             * an editorInteraction event occurs and the target element of the
             * corresponding native event has this class, the toolbar is shown.
             *
             * @property config
             * @type Object
             * @required
             */
            config: React.PropTypes.object.isRequired,

            /**
             * Holds the AlloyEditor instance
             *
             * @property editor
             * @type AlloyEditor.Core
             * @required
             */
            editor: React.PropTypes.object.isRequired,

            /**
             * The last editor event
             *
             * @property editorEvent
             * @type Object
             */
            editorEvent: React.PropTypes.object,
        },

        getInitialState: function () {
            return {
                visible: false,
                itemExclusive: null
            };
        },

        componentWillReceiveProps: function (newProps) {
            var nativeEventTarget,
                visible = false;

            if ( newProps.editorEvent && this.props.editorEvent !== newProps.editorEvent ) {
                nativeEventTarget = newProps.editorEvent.data.nativeEvent.target;
                visible = (
                    nativeEventTarget &&
                    nativeEventTarget.classList &&
                    nativeEventTarget.classList.contains(
                        newProps.config.addContentButtonClass
                    )
                );
            }
            this.setState({
                visible: visible,
            });
        },

        componentDidMount: function () {
            this._updatePosition();
        },

        componentDidUpdate: function (prevProps, prevState) {
            this._updatePosition();
        },

        /**
         * Updates the position of the toolbar so that it appears on top of the
         * add content button and in the center (horizontal) of the editor.
         *
         * @method _updatePosition
         * @private
         */
        _updatePosition: function () {
            var edRoot = this.props.editor.get('nativeEditor').element,
                staticToolbar = edRoot.findOne('.ez-ae-static-toolbar'),
                toolbarRect = staticToolbar.getClientRect(),
                container = React.findDOMNode(this);

            if ( container ) {
                container.style.top = (toolbarRect.top - container.clientHeight + window.scrollY) + 'px';
                container.style.left = (toolbarRect.left + edRoot.getSize('width', true)/2 - container.clientWidth/2) + 'px';
                container.style.opacity = 1;
            }
        },

        getDefaultProps: function () {
            return {
                circular: true,
                descendants: '.ae-button, .ae-toolbar-element',
                keys: {
                    next: [38, 39],
                    prev: [37, 40]
                }
            };
        },

        render: function () {
            var buttons = this.getToolbarButtons(this.props.config.buttons),
                css = "ae-toolbar-appendcontent ez-ae-appendcontent ae-toolbar-transition ae-arrow-box ae-arrow-box-bottom";

            if ( !this.state.visible ) {
                return null;
            }
            // TODO: remove that config and switch to ESLint
            // see https://jira.ez.no/browse/EZP-23209
            /* jshint maxlen: false */
            return (
                <div className={css} data-tabindex={this.props.config.tabIndex || 0} onFocus={this.focus} onKeyDown={this.handleKey} tabIndex="-1" role="toolbar">
                    <div className="ae-container">
                        {buttons}
                    </div>
                </div>
            );
            /* jshint maxlen: 120 */
        },
    });

    AlloyEditor.Toolbars[ToolbarAppendContent.key] = AlloyEditor.ToolbarAppendContent = ToolbarAppendContent;
});
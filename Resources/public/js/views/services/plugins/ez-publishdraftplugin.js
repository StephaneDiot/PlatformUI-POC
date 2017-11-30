/*
 * Copyright (C) eZ Systems AS. All rights reserved.
 * For full copyright and license information view LICENSE file distributed with this source code.
 */
YUI.add('ez-publishdraftplugin', function (Y) {
    "use strict";
    /**
     * Provides the publish draft plugin
     *
     * @module ez-publishdraftplugin
     */
    Y.namespace('eZ.Plugin');

    /**
     * Publish draft plugin. It publishes the version hold by the host object (a
     * service) when the publishAction event is triggered.
     *
     * @namespace eZ.Plugin
     * @class PublishDraft
     * @constructor
     * @extends eZ.Plugin.ViewServiceBase
     */
    Y.eZ.Plugin.PublishDraft = Y.Base.create('publishDraftPlugin', Y.eZ.Plugin.ViewServiceBase, [Y.eZ.DraftServerSideValidation], {
        initializer: function () {
            this.onHostEvent('*:publishAction', this._publishDraft);
            this.onHostEvent('*:locateAction', this._publishDraft);
            this.onHostEvent('*:autolocateAction', this._publishDraft);
        },

        /**
         * Event handler for the publishAction event. It publishes the version
         * if the form is valid and redirect the user to the URL hold by the
         * `publishRedirectionUrl` attribute.
         *
         * @method _publishDraft
         * @protected
         * @param {Object} e publishAction event facade
         */
        _publishDraft: function (e) {
            var service = this.get('host'),
                content = service.get('content'),
                notificationIdentifier,
                app = service.get('app'),
                buttonActionView = e.target,
                event = e;

            this.set('buttonActionView', buttonActionView);
            this.set('fields', e.fields);

            if (e.selectLocationFlag || e.target.get('actionId') == 'locate') {
                this.set('createLocation', true);

            }

                if ( !e.formIsValid ) {
                    return;
                }
                if (content.isNew()) {
                    notificationIdentifier = this._buildNotificationIdentifier(false);
                } else {
                    notificationIdentifier = this._buildNotificationIdentifier(content.get('id'));
                }

                /**
                 * Stores a custom _serverSideErrorCallback sent in the `publishAction` event parameters.
                 *
                 * @property _serverSideErrorCallback
                 * @protected
                 * @type {Function}
                 */
                this._serverSideErrorCallback = e.serverSideErrorCallback;

                service.fire('notify', {
                    notification: {
                        identifier: notificationIdentifier,
                        text: Y.eZ.trans('publishing.content', {}, 'contentedit'),
                        state: 'started',
                        timeout: 5,
                    },
                });

                if(this.get('createLocation')) {
                    this.set('createLocation', false);
                    this._createLocationSelect();
                } else if (e.autoLocateFlag || e.target.get('actionId') == 'autolocate') {
                    this._findAutoLocation();
                } else {
                    app.set('loading', true);
                    buttonActionView.set("disabled", true);

                    app.onceAfter('loadingChange', function () {
                        buttonActionView.set("disabled", false);
                    });
                    if ( content.isNew() ) {
                        this._set('isNewContent', true);
                        this._createPublishContent(e.fields);
                    } else {
                        this._savePublishVersion(e.fields);
                    }
                }
        },
        /**
         * Fire 'notify' event
         *
         * @method _notify
         * @protected
         * @param {String} text the text shown during the notification
         * @param {String} identifier the identifier of the notification
         * @param {String} state the state of the notification
         * @param {Integer} timeout the number of second, the notification will be shown
         */
        _notify: function (text, identifier, state, timeout) {
            this.get('host').fire('notify', {
                notification: {
                    text: text,
                    identifier: identifier,
                    state: state,
                    timeout: timeout,
                }
            });
        },
        _publishDraftInLocation: function (e, event) {
            var service = this.get('host'),
                content = service.get('content'),
                notificationIdentifier,
                app = service.get('app'),
                buttonActionView = e.target,
                capi = service.get('capi'),
                version = service.get('version'),
                content = service.get('content'),
                options = {api: capi};

            if ( !e.formIsValid ) {
                return;
            }

                notificationIdentifier = this._buildNotificationIdentifier(false);


            /**
             * Stores a custom _serverSideErrorCallback sent in the `publishAction` event parameters.
             *
             * @property _serverSideErrorCallback
             * @protected
             * @type {Function}
             */
            this._serverSideErrorCallback = e.serverSideErrorCallback;

            service.fire('notify', {
                notification: {
                    identifier: notificationIdentifier,
                    text: Y.eZ.trans('publishing.content', {}, 'contentedit'),
                    state: 'started',
                    timeout: 5,
                },
            });

            app.set('loading', true);
            buttonActionView.set("disabled", true);

            app.onceAfter('loadingChange', function () {
                buttonActionView.set("disabled", false);
            });

            this._set('isNewContent', true);
            content.save({
                api: capi,
                languageCode: service.get('languageCode'),
                contentType: service.get('contentType'),
                parentLocation: event.selection.location,
                fields: e.fields,
            }, Y.bind(function (error, response) {
                if ( error ) {
                    this._parseServerFieldsErrors(response, this._serverSideErrorCallback);
                    this._notifyError(content.get('id'));
                    service.get('app').set('loading', false);
                    return;
                }
                version.setAttrs(version.parse({document: response.document.Content.CurrentVersion}));
                version.publishVersion(options, Y.bind(this._publishDraftCallback, this));
            }, this));
        },

        /**
         * Notify the user about the publish process and fire the `publishedDraft`
         * event.
         *
         * @method _publishDraftCallback
         * @param {Object} error The error object.
         * @param {Object} response The response object.
         * @protected
         */
        _publishDraftCallback: function (error, response) {
            var service = this.get('host'),
                app = this.get('host').get('app'),
                content = service.get('content'),
                notificationIdentifier = this._buildNotificationIdentifier(content.get('id'));

            if ( error ) {
                this._parseServerFieldsErrors(response, this._serverSideErrorCallback);
                this._notifyError(content.get('id'));
                app.set('loading', false);
                return;
            }

            if (this.get('isNewContent')) {
                notificationIdentifier = this._buildNotificationIdentifier(false);
            }

            service.fire('notify', {
                notification: {
                    identifier: notificationIdentifier,
                    text: Y.eZ.trans('content.published', {}, 'contentedit'),
                    state: 'done',
                    timeout: 5,
                },
            });

            content.load({api: service.get('capi')}, function (error, response) {
                /**
                 * Fired when the draft is published
                 *
                 * @event publishedDraft
                 * @param {eZ.Content} content
                 */
                service.fire('publishedDraft', {content: content});
            });

        },
        _createLocationSelect: function () {
            var service = this.get('host');
            service.fire('contentDiscover', {
                config: {
                    title: 'Select the locations of your content',
                    contentDiscoveredHandler: Y.bind(this._storeSelection, this),
                    multiple: true,
                    isSelectable: function (contentStruct) {
                        return contentStruct.contentType.get('isContainer');
                    },
                },
            });
        },

        _findAutoLocation: function () {
            var service = this.get('host'),
                that = this,
                locationStr,
                parentLocation;

            if (service.get('parentLocation')) {

                this.get('host').get('capi').getContentService().loadLocations(service.get('parentLocation').get('contentInfo').get('id'), function(error, response){
                    that._storeAutoLocationList(response);
                });
            } else {
                locationStr = service.get('location').get('id').split('/');
                locationStr.pop();
                parentLocation = locationStr.join('/');
                this.get('host').get('capi').getContentService().loadLocation(parentLocation, function(error, response) {
                    that.get('host').get('capi').getContentService().loadLocations(response.document.Location.ContentInfo._href, function(error, response){
                        that._storeAutoLocationList(response);
                    });
                });
            }
        },

        _storeAutoLocationList: function (response) {
            var service = this.get('host'),
                content = service.get('content'),
                app = service.get('app'),
                that = this;

            that.set('autoLocationList', response.document.LocationList);
            app.set('loading', true);
            this.get('buttonActionView').set("disabled", true);

            app.onceAfter('loadingChange', function () {
                that.get('buttonActionView').set("disabled", false);
            });
            if ( content.isNew() ) {
                this._set('isNewContent', true);
                this._createPublishContent(that.get('fields'));
            } else {
                this._savePublishVersion(that.get('fields'));
            }

        },

        _storeSelection: function (e) {
            var service = this.get('host'),
                content = service.get('content'),
                app = service.get('app'),
                that = this;

            this.set('selection', e.selection);
            app.set('loading', true);
            this.get('buttonActionView').set("disabled", true);

            app.onceAfter('loadingChange', function () {
                that.get('buttonActionView').set("disabled", false);
            });
            if ( content.isNew() ) {
                this._set('isNewContent', true);
                this._createPublishContent(that.get('fields'));
            } else {
                this._savePublishVersion(that.get('fields'));
            }

        },
        /**
         * Creates new location as a descendant of selected location
         *
         * @method _createLocation
         * @protected
         * @param {EventFacade} e
         */
        _createLocation: function () {
            var service = this.get('host'),
                capi = service.get('capi'),
                content = service.get('content'),
                locationsCreatedCounter = 0,
                notificationIdentifier = 'create-location-' + content.get('id'),

                stack = new Y.Parallel(),
                that = this;

            this._notify(
                Y.eZ.trans('creating.new.location.for', {name: content.get('name')}, 'bar'),
                notificationIdentifier,
                'started',
                5
            );

            Y.Array.each(this.get('selection'), function (selection) {
                var parentLocation = selection.location,
                    parentContentInfo = selection.contentInfo,
                    errNotificationIdentifier = 'create-location-' + content.get('id') + '-' + parentContentInfo.get('id'),
                    end = stack.add(function (error) {
                        if (error) {
                            that._notify(
                                Y.eZ.trans(
                                    'failed.creating.new.location.for',
                                    {name: content.get('name'), parentName: parentContentInfo.get('name')},
                                    'bar'
                                ),
                                errNotificationIdentifier,
                                'error',
                                0
                            );
                            return;
                        }

                        locationsCreatedCounter++;
                    });

                content.addLocation({api: capi}, parentLocation, end);
            });

            stack.done(function () {
                if (locationsCreatedCounter > 0) {
                    var msg = Y.eZ.trans('location.created', {name: content.get('name')}, 'bar');

                    if (locationsCreatedCounter > 1) {
                        msg = Y.eZ.trans(
                            'locations.created',
                            {count: locationsCreatedCounter, name: content.get('name')},
                            'bar'
                        );
                    }
                    that._notify(
                        msg,
                        notificationIdentifier,
                        'done',
                        5
                    );

                } else {
                    that._notify(
                        Y.eZ.trans('creating.new.location.for.failed', {name: content.get('name')}, 'bar'),
                        notificationIdentifier,
                        'error',
                        0
                    );
                }

            });
            this.set('selection', null);
        },

        _createAutoLocation: function () {
            var service = this.get('host'),
                capi = service.get('capi'),
                content = service.get('content'),
                contentService = capi.getContentService(),
                locationsCreatedCounter = 0,
                notificationIdentifier = 'create-location-' + content.get('id'),

                stack = new Y.Parallel(),
                that = this;

            this._notify(
                Y.eZ.trans('creating.new.location.for', {name: content.get('name')}, 'bar'),
                notificationIdentifier,
                'started',
                5
            );

            Y.Array.each(this.get('autoLocationList').Location, function (selection) {
                var parentLocation = selection,
                    locationCreateStruct,

                    errNotificationIdentifier = 'create-location-' + content.get('id'),
                    end = stack.add(function (error) {
                        if (error) {
                            that._notify(
                                Y.eZ.trans(
                                    'failed.creating.new.location.for',
                                    {name: content.get('name'), parentName:''},
                                    'bar'
                                ),
                                errNotificationIdentifier,
                                'error',
                                0
                            );
                            return;
                        }
                        locationsCreatedCounter++;
                    });
                    locationCreateStruct = contentService.newLocationCreateStruct(selection._href);
                    contentService.createLocation(content.get('id'), locationCreateStruct, function() {});
            });

            stack.done(function () {
                if (locationsCreatedCounter > 0) {
                    var msg = Y.eZ.trans('location.created', {name: content.get('name')}, 'bar');

                    if (locationsCreatedCounter > 1) {
                        msg = Y.eZ.trans(
                            'locations.created',
                            {count: locationsCreatedCounter, name: content.get('name')},
                            'bar'
                        );
                    }
                    that._notify(
                        msg,
                        notificationIdentifier,
                        'done',
                        5
                    );

                } else {
                    that._notify(
                        Y.eZ.trans('creating.new.location.for.failed', {name: content.get('name')}, 'bar'),
                        notificationIdentifier,
                        'error',
                        0
                    );
                }

            });
            this.set('autoLocationList', null);
        },

        /**
         * Creates a draft of a new content with the given fields and directly
         * tries to publish it.
         *
         * @method _createPublishContent
         * @param Array fields the fields structures coming from the
         * publishAction event
         * @protected
         */
        _createPublishContent: function (fields) {
            var service = this.get('host'),
                capi = service.get('capi'),
                version = service.get('version'),
                content = service.get('content'),
                options = {api: capi},
                that = this;

            content.save({
                api: capi,
                languageCode: service.get('languageCode'),
                contentType: service.get('contentType'),
                parentLocation: service.get('parentLocation'),
                fields: fields,
            }, Y.bind(function (error, response) {
                if ( error ) {
                    this._parseServerFieldsErrors(response, this._serverSideErrorCallback);
                    this._notifyError(content.get('id'));
                    service.get('app').set('loading', false);
                    return;
                }
                version.setAttrs(version.parse({document: response.document.Content.CurrentVersion}));
                version.publishVersion(options, function(){
                    if (that.get('selection')) {
                        that._createLocation();
                    } else if (that.get('autoLocationList')){
                        that._createAutoLocation();
                    }
                    that._publishDraftCallback()
                    });
            }, this));
        },

        /**
         * Sets the given fields on the version and publishes it. This method is
         * called in the case where the content already exists in the repository
         * and the user wants to publish a new version of it.
         *
         * @method _savePublishVersion
         * @param Array fields the fields structures coming from the
         * publishAction event
         * @protected
         */
        _savePublishVersion: function (fields) {
            var service = this.get('host'),
                version = service.get('version'),
                content = service.get('content'),
                that = this;

            version.save({
                api: service.get('capi'),
                fields: fields,
                contentId: content.get('id'),
                languageCode: service.get('languageCode'),
                publish: true,
            }, function(){
                if (that.get('selection')) {
                    that._createLocation();

                } else if (that.get('autoLocationList')){
                    that._createAutoLocation();
                }
                that._publishDraftCallback();
                });
        },

        /**
         * Notifies the editor about a publishing error
         *
         * @method _notifyError
         * @protected
         * @param {String} contentId
         */
        _notifyError: function (contentId) {
            this.get('host').fire('notify', {
                notification: {
                    identifier: this._buildNotificationIdentifier(contentId),
                    text: Y.eZ.trans('error.publishing.draft', {}, 'contentedit'),
                    state: 'error',
                    timeout: 0,
                },
            });
        },

        /**
         * Builds the notification identifier for the publish notification
         *
         * @method _buildNotificationIdentifier
         * @param {Boolean} isNew
         * @param {eZ.Content} content
         * @protected
         */
        _buildNotificationIdentifier: function (contentId) {

            if (contentId) {
                return 'publish-' + contentId + '-' + this.get('host').get('languageCode');
            } else {
                return 'publish-' + this.get('host').get('languageCode');
            }
        },
    }, {
        NS: 'publishDraft',

        ATTRS: {
            /**
             * Hold the flag to see if the published content already exists
             *
             * @attribute isNewContent
             * @type Boolean
             * @default false
             */
            isNewContent: {
                value: false
            }
        },
    });

    Y.eZ.PluginRegistry.registerPlugin(
        Y.eZ.Plugin.PublishDraft, ['contentEditViewService', 'contentCreateViewService']
    );
});

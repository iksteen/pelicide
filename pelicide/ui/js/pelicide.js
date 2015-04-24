define([
    'js/util',
    'js/sidebar',
    'js/editor',
    'js/preview',
    'jquery',
    'jquery_jsonrpc',
    'w2ui'
], function(Util, Sidebar, Editor, Preview, jQuery) {

    function Pelicide(options) {
        options = jQuery.extend({}, {
            previewDelay: 50,
            contentTypes: [],
            editors: []
        }, options);

        this.handlers = [];
        this._otherContentId = null;

        var i;

        this._contentTypes = [];
        for (i = 0; i < options.contentTypes.length; ++i)
            this._contentTypes.push(new options.contentTypes[i](this));

        this.sidebar = new Sidebar(this);
        this.editor = new Editor(this, options.editors);
        this.preview = new Preview(this, options.previewDelay);
    }

    Pelicide.prototype = {
        run: function (box) {
            var self = this,
                layout = this.initLayout(box);
            this.initEditorLayout();

            /* Run this as a timeout to allow the DOM to settle. */
            setTimeout(function () {
                /* Initialise the editor and preview panel. */
                self.editor.create(w2ui['editor'].el('main'));
                self.preview.create(w2ui['editor'].el('right'), w2ui['editor_right_toolbar']);

                /* Set up event handlers. */
                self.editor.on('dirty', function (e) {
                    w2ui['editor_main_toolbar'].set('save', {disabled: !e.dirty});
                });
                self.editor.on({ type: 'open', execute: 'after' }, function (e) {
                    w2ui['editor_main_toolbar'].enable('rebuild_page');
                });
                self.editor.on({ type: 'close', execute: 'after' }, function (e) {
                    w2ui['editor_main_toolbar'].disable('rebuild_page');
                });
            }, 0);

            /* Initialise sidebar and content type plugins. */
            layout.content('left', this.sidebar.create());

            jQuery.each(this._contentTypes, function (i, contentType) {
                contentType.init();
            });
            this._otherContentId = this.sidebar.addContentType('Other');

            this.loadProject();
        },

        initLayout: function (box) {
            var self = this;

            return jQuery(box).w2layout({
                name: 'layout',
                panels: [
                    {
                        type: 'left',
                        size: 240,
                        resizable: true,
                        toolbar: {
                            items: [
                                {
                                    type: 'button',
                                    id: 'refresh',
                                    icon: 'fa fa-refresh',
                                    hint: 'Refresh project',
                                    onClick: function () { self.loadProject(); }
                                },
                                {
                                    type: 'button',
                                    id: 'rebuild',
                                    icon: 'fa fa-wrench',
                                    hint: 'Rebuild project',
                                    onClick: function () { self.rebuildProject(); }
                                }
                            ]
                        }
                    },
                    {
                        type: 'main'
                    }
                ]
            });
        },

        initEditorLayout: function () {
            var self = this;

            jQuery().w2layout({
                name: 'editor',
                panels: [
                    {
                        type: 'main',
                        size: '50%',
                        toolbar: {
                            items: [
                                {
                                    type: 'check',
                                    id: 'sidebar',
                                    icon: 'fa fa-bars',
                                    hint: 'Toggle sidebar',
                                    checked: true,
                                    onClick: function () { self.togglePreview(); }
                                },
                                {type: 'break'},
                                {
                                    type: 'button',
                                    id: 'save',
                                    disabled: true,
                                    icon: 'fa fa-save',
                                    hint: 'Save',
                                    onClick: function () { self.editor.save(); }
                                },
                                {
                                    type: 'button',
                                    id: 'rebuild_page',
                                    icon: 'fa fa-wrench',
                                    hint: 'Rebuild page',
                                    disabled: true,
                                    onClick: function () { self.rebuildPage(); }
                                },
                                {type: 'spacer', id: 'editor_insert_point'},
                                {
                                    type: 'check',
                                    id: 'preview',
                                    icon: 'fa fa-eye',
                                    hint: 'Toggle preview',
                                    checked: true,
                                    onClick: function () { self.togglePreview(); }
                                }
                            ]
                        }
                    },
                    jQuery.extend({}, this.preview.layout(), { type: 'right', size: '50%' })
                ]
            });

            w2ui['layout'].content('main', w2ui['editor']);
        },

        toggleSidebar: function () {
            w2ui['layout'].toggle('left');
        },

        togglePreview: function () {
            w2ui['editor'].toggle('right');
        },

        loadProject: function () {
            var self = this;

            function addContentNodes(items) {
                /* Sort items by path and file name. */
                items.sort(function (a, b) {
                    var n = Math.min(a.path.length, b.path.length);
                    for (var i = 0; i < n; ++i) {
                        var c = a.path[i].localeCompare(b.path[i]);
                        if(c)
                            return c;
                    }

                    if (a.path.length < b.path.length)
                        return -1;
                    else if (a.length > b.length)
                        return 1;
                    else
                        return a.file.name.localeCompare(b.file.name);
                });

                /* Create nodes for all content items */
                for(var i = 0; i < items.length; ++i) {
                    var item = items[i];
                    self.sidebar.addFile(item.path, item.file);
                }
            }

            this.editor.close(function () {
                self.sidebar.lock('Loading...', true);
                self.sidebar.clear();

                jQuery.jsonRPC.request('get_settings', {
                    success: function (result) {
                        if (result.result['SITENAME']) {
                            document.title = result.result['SITENAME'] + ' (Pelicide)';
                            self.sidebar.contentTitle(result.result['SITENAME']);
                        }
                    },
                    error: function (e) {
                        self.sidebar.contentTitle(null);
                        Util.alert(e);
                    }
                });

                jQuery.jsonRPC.request('list_content', {
                    success: function (result) {
                        var items = [];

                        for (var i = 0; i < result.result.length; ++i) {
                            var file = result.result[i];

                            for (var j = 0; j < self._contentTypes.length; ++j) {
                                var contentType = self._contentTypes[j],
                                    path = contentType.scan(file);

                                if (path !== undefined) {
                                    items.push({
                                        path: ['content'].concat(path),
                                        file: file
                                    });
                                    break;
                                }
                            }
                            if (j == self._contentTypes.length) {
                                items.push({
                                    path: ['content', self._otherContentId].concat(file.dir),
                                    file: file
                                });
                            }
                        }

                        addContentNodes(items);

                        self.sidebar.unlock();
                    },

                    error: function (e) {
                        self.sidebar.unlock();
                        Util.alert(e);
                    }
                });
            });
        },

        rebuildProject: function () {
            var self = this;

            w2ui['layout_left_toolbar'].disable('rebuild');

            var eventData = {
                type: 'rebuild-project',
                phase: 'before',
                target: this,
                onComplete: function () {
                    w2ui['layout_left_toolbar'].enable('rebuild');
                }
            };
            this.trigger(eventData);
            if (eventData.isCancelled === true) {
                eventData.onComplete();
            }

            this.editor.save(function() {
                jQuery.jsonRPC.request('build', {
                    success: function () {
                        self.trigger(jQuery.extend(eventData, { phase: 'after', success: true }));
                    },
                    error: function (e) {
                        self.trigger(jQuery.extend(eventData, { phase: 'after', success: false, error: e }));
                        Util.alert(e);
                    }
                });
            });
        },

        rebuildPage: function () {
            var self = this,
                state = this.editor.state();

            w2ui['editor_main_toolbar'].disable('rebuild_page');

            if (state) {
                var eventData = {
                    type: 'rebuild-page',
                    phase: 'before',
                    target: this,
                    onComplete: function() {
                        w2ui['editor_main_toolbar'].set('rebuild_page', {disabled: self._editor === null});
                    }
                };
                this.trigger(eventData);
                if (eventData.isCancelled === true) {
                    eventData.onComplete();
                }

                this.editor.save(function () {
                    jQuery.jsonRPC.request('build', {
                        params: [[[state.file.dir, state.file.name]]],
                        success: function () {
                            self.trigger(jQuery.extend(eventData, { phase: 'after', success: true }));
                        },
                        error: function (e) {
                            self.trigger(jQuery.extend(eventData, { phase: 'after', success: false, error: e }));
                            Util.alert(e);
                        }
                    });
                });
            }
        }
    };
    jQuery.extend(Pelicide.prototype, w2utils.event);

    return Pelicide;
});

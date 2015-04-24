define([
    'js/util',
    'js/sidebar',
    'js/editor',
    'jquery',
    'jquery_jsonrpc',
    'w2ui'
], function(Util, Sidebar, Editor, jQuery) {

    function Pelicide(options) {
        options = jQuery.extend({}, {
            previewDelay: 50,
            contentTypes: [],
            editors: []
        }, options);

        this._otherContentId = null;
        this._previewDelay = options.previewDelay;
        this._previewMode = null;
        this._previewPending = false;

        var i;

        this._contentTypes = [];
        for (i = 0; i < options.contentTypes.length; ++i)
            this._contentTypes.push(new options.contentTypes[i](this));

        this.sidebar = new Sidebar(this);
        this.editor = new Editor(this, options.editors);
    }

    Pelicide.prototype = {
        run: function (box) {
            var self = this,
                layout = this.initLayout(box);
            this.initEditorLayout();

            /* Run this as a timeout to allow the DOM to settle. */
            setTimeout(function () {
                /* Initialise the editor */
                self.editor.create(w2ui['editor'].el('main'));
                self.editor.on('dirty', function (e) {
                    w2ui['editor_main_toolbar'].set('save', {disabled: !e.dirty});
                });
                self.editor.on({ type: 'open', execute: 'after' }, function (e) {
                    w2ui['editor_main_toolbar'].enable('rebuild_page');
                    w2ui['editor_right_toolbar'].enable('update_preview');
                    self.updatePreview();
                });
                self.editor.on({ type: 'close', execute: 'after' }, function (e) {
                    w2ui['editor_main_toolbar'].disable('rebuild_page');
                    w2ui['editor_right_toolbar'].disable('update_preview');
                    self.updatePreview();
                });
            }, 0);

            /* Initialise sidebar and content type plugins. */
            layout.content('left', this.sidebar.create());

            jQuery.each(this._contentTypes, function (i, contentType) {
                contentType.init();
            });
            this._otherContentId = this.sidebar.addContentType('Other');

            this.previewMode('draft');
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
                    {
                        type: 'right',
                        size: '50%',
                        overflow: 'hidden',
                        toolbar: {
                            items: [
                                {
                                    type: 'radio',
                                    id: 'draft',
                                    group: '1',
                                    caption: 'Draft',
                                    checked: true,
                                    onClick: function () { self.previewMode('draft'); }
                                },
                                {
                                    type: 'radio',
                                    id: 'render',
                                    group: '1',
                                    caption: 'Render',
                                    onClick: function () { self.previewMode('render'); }
                                },
                                {type: 'break'},
                                {
                                    type: 'button',
                                    id: 'update_preview',
                                    icon: 'fa fa-refresh',
                                    hint: 'Refresh',
                                    disabled: true,
                                    onClick: function () { self.updatePreview(); }
                                }
                            ]
                        }
                    }
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

            this.editor.save(function() {
                jQuery.jsonRPC.request('build', {
                    success: function () {
                        w2ui['layout_left_toolbar'].enable('rebuild');
                        if (self.previewMode() == 'render')
                            self.updatePreview();
                    },
                    error: function (e) {
                        w2ui['layout_left_toolbar'].enable('rebuild');
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
                this.editor.save(function () {
                    jQuery.jsonRPC.request('build', {
                        params: [[[state.file.dir, state.file.name]]],
                        success: function () {
                            w2ui['editor_main_toolbar'].set('rebuild_page', {disabled: self._editor === null});
                            if(self.previewMode() == 'render') {
                                self.updatePreview();
                            }
                        },
                        error: function (e) {
                            w2ui['editor_main_toolbar'].set('rebuild_page', {disabled: self._editor === null});
                            Util.alert(e);
                        }
                    });
                });
            }
        },

        previewMode: function (mode) {
            if(mode === undefined) {
                return this._previewMode;
            }

            setTimeout(function() {
                w2ui['editor_right_toolbar'].check((mode == 'render') ? 'render' : 'draft');
                w2ui['editor_right_toolbar'].uncheck((mode == 'render') ? 'draft' : 'render');
            }, 0);

            if(mode != this._previewMode) {
                this._previewMode = mode;

                if (mode == 'render') {
                    w2ui['editor'].content('right', '<iframe id="render"></iframe>');
                    this.updatePreview();
                } else {
                    w2ui['editor'].content('right', '<div id="preview_container"><div id="preview"></div></div>');
                    this.updatePreview();
                }
            }
        },

        schedulePreview: function () {
            var self = this;

            if (this.previewMode() == 'draft' && !this._previewPending) {
                this._previewPending = true;
                setTimeout(function () {
                    self._previewPending = false;
                    self.updatePreview();
                }, this._previewDelay);
            }
        },

        updatePreview: function () {
            var state = this.editor.state();

            if(this.previewMode() != 'render') {
                var preview = jQuery('#preview');

                if (state) {
                    jQuery.jsonRPC.request('render', {
                        params: [state.mode, state.content],
                        success: function (result) {
                            preview.html(result.result);
                        },
                        error: function(error) {
                            preview.empty().append(
                                '<h3 style="color: red">Render failed:</h3>',
                                jQuery('<p>').html(error.error.message)
                            );
                        }
                    })
                } else {
                    preview.empty();
                }
            } else {
                if(state && state.file.url) {
                    var old_frame=$('#render'),
                        new_frame = $('<iframe>').appendTo(old_frame.parent());

                    new_frame.one('load', function () {
                        try {
                            // Try to preserve the old scroll position.
                            var old_doc = old_frame.contents();
                            if (old_doc.prop('location') == state.file.url) {
                                var old_body = old_doc.find('body'),
                                    top = old_body.scrollTop(),
                                    left = old_body.scrollLeft();
                                new_frame.contents().find('body').scrollTop(top).scrollLeft(left);
                            }
                        } catch (e) {
                            // If the user navigated away from the service application, a cross origin
                            // frame access exception will be raised.
                        }
                        old_frame.remove();
                        new_frame.attr('id', 'render');
                    }).attr('src', state.file.url);
                } else {
                    $('#render').attr('src', '');
                }
            }
        },

        setUpPreviewScrollSync: function (el) {
            var pending = false;

            el = jQuery(el);
            el.on('scroll', function (e) {
                if (!pending) {
                    pending = true;
                    setTimeout(function () {
                        var target = jQuery('#preview_container'),
                            f = el.scrollTop() / (el.prop('scrollHeight') - el.prop('offsetHeight'));
                        target.scrollTop(f * (target.prop('scrollHeight') - target.prop('offsetHeight')));
                        pending = false;
                    }, 25);
                }
            });
        }
    };

    return Pelicide;
});

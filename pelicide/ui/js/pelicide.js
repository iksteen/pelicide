define([
    'jquery',
    'jquery_jsonrpc',
    'w2ui'
], function(jQuery, _, _) {

    function getErrorMessage(e) {
        if(e.error) {
            if(e.error.message !== undefined)
                return e.error.message;
            else
                return e.error;
        }
        else
            return e;
    }

    function showError(e) {
        w2alert(getErrorMessage(e));
    }

    function Pelicide() {
    }

    Pelicide.prototype = {
        previewDelay: 50,
        _editors: {},
        _content: {},
        _editor: null,
        _dirty: false,
        _currentFormat: null,
        _currentFile: null,
        _previewMode: null,
        _previewPending: false,

        run: function (box) {
            var self = this;

            this.initLayout(box);
            this.initSidebar();
            this.initEditorLayout();

            setTimeout(function () {
                self.previewMode('draft');
                self.loadProject();
            }, 0);
        },

        initLayout: function (box) {
            var self = this;

            jQuery(box).w2layout({
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

        initSidebar: function () {
            var self = this;

            w2ui['layout'].content('left', jQuery().w2sidebar({
                name: 'sidebar',
                nodes: [
                    {
                        id: 'content',
                        text: 'Content',
                        expanded: true,
                        group: true,
                        nodes: [
                            {
                                id: 'articles',
                                text: 'Articles',
                                icon: 'fa fa-folder'
                            },
                            {
                                id: 'pages',
                                text: 'Pages',
                                icon: 'fa fa-folder'
                            },
                            {
                                id: 'other',
                                text: 'Other',
                                icon: 'fa fa-folder'
                            }
                        ]
                    }
                ],
                onDblClick: function (e) {
                    var file = self._content[e.target];
                    if (file !== undefined) {
                        self.load(file);
                    }
                }
            }));
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
                                    onClick: function () { self.save(); }
                                },
                                {
                                    type: 'button',
                                    id: 'rebuild_page',
                                    icon: 'fa fa-wrench',
                                    hint: 'Rebuild page',
                                    disabled: true,
                                    onClick: function () { self.rebuildPage(); }
                                },
                                {type: 'spacer'},
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

        dirty: function(dirty) {
            if(dirty === undefined) {
                return this._editor && this._dirty;
            }

            this._dirty = dirty;
            w2ui['editor_main_toolbar'].set('save', {disabled: this._editor === null || !dirty});
        },

        toggleSidebar: function () {
            w2ui['layout'].toggle('left');
        },

        togglePreview: function () {
            w2ui['editor'].toggle('right');
        },

        loadProject: function () {
            var self = this,
                sidebar = w2ui['sidebar'],
                node_id = 0,
                path_nodes = {};

            function getNodeForPath(parent, path) {
                var node=path_nodes[parent];

                jQuery.each(path, function(i, elem) {
                    if(node.nodes.hasOwnProperty(elem)) {
                        node = node.nodes[elem];
                    } else {
                        var id = 'content_' + (++node_id);
                        sidebar.add(node.id, {
                            id: id,
                            text: elem,
                            icon: 'fa fa-folder-o'
                        });
                        node.nodes[elem] = {
                            id: id,
                            nodes: {}
                        };
                        node = node.nodes[elem];
                    }
                });

                return node.id;
            }

            function addContentNodes(parent, files) {
                /* Sort paths */
                var paths = [];
                jQuery.each(files, function (i, file) {
                    if (jQuery.inArray(file.dir, paths) == -1)
                        paths.push(file.dir);
                });
                paths.sort(function (a, b) {
                    var n = Math.min(a.length, b.length);
                    for (var i = 0; i < n; ++i) {
                        var c = a[i].localeCompare(b[i]);
                        if(c)
                            return c;
                    }

                    return (a.length < b.length) ? -1 : ((a.length == b.length) ? 0 : -1);
                });

                /* Create path nodes */
                jQuery.each(paths, function (i, path) {
                    getNodeForPath(parent, path);
                });

                /* Sort files by name */
                files.sort(function (a, b) {
                    return a.name.localeCompare(b.name);
                });

                /* Create nodes for all content */
                jQuery.each(files, function (i, file) {
                    var id = 'content_' + (++node_id),
                        path_node = getNodeForPath(parent, file.dir);

                    self._content[id] = file;
                    sidebar.add(path_node, {
                        id: id,
                        text: file.name,
                        icon: 'fa fa-file-text-o',
                        disabled: self.findEditor(self.getFormat(file.name)) === undefined
                    });
                });
            }

            this.close(function () {
                sidebar.lock('Loading...', true);

                self._content = {};
                jQuery.each(sidebar.find({parent: sidebar.get('content')}), function (i, node) {
                    sidebar.remove.apply(sidebar, sidebar.find(node, {}));
                    path_nodes[node.id] = {
                        id: node.id,
                        nodes: {}
                    }
                });

                jQuery.jsonRPC.request('get_settings', {
                    success: function (result) {
                        if (result.result['SITENAME']) {
                            document.title = result.result['SITENAME'] + ' (Pelicide)';
                            sidebar.get('content').text = result.result['SITENAME'];
                            sidebar.refresh('content');
                        }
                    },
                    error: showError
                });

                jQuery.jsonRPC.request('list_content', {
                    success: function (result) {
                        var files = {
                                articles: [],
                                pages: [],
                                other: []
                            };

                        jQuery.each(result.result, function (i, file) {
                            if(file.type == 'pelican.contents.Article')
                                files.articles.push(file);
                            else if(file.type == 'pelican.contents.Page')
                                files.pages.push(file);
                            else
                                files.other.push(file);
                        });

                        jQuery.each(['articles', 'pages', 'other'], function (i, type) {
                            addContentNodes(
                                type,
                                files[type]
                            );
                        });

                        sidebar.unlock();
                    },
                    error: showError
                });
            });
        },

        rebuildProject: function () {
            var self = this;

            w2ui['layout_left_toolbar'].disable('rebuild');

            this.save(function() {
                jQuery.jsonRPC.request('build', {
                    success: function () {
                        w2ui['layout_left_toolbar'].enable('rebuild');
                        if (self.previewMode() == 'render')
                            self.updatePreview();
                    },
                    error: function (e) {
                        w2ui['layout_left_toolbar'].enable('rebuild');
                        showError(e);
                    }
                });
            });
        },

        rebuildPage: function () {
            var self = this,
                file = this._currentFile;
            w2ui['editor_main_toolbar'].disable('rebuild_page');

            if (file && this._editor !== null) {
                this.save(function () {
                    jQuery.jsonRPC.request('build', {
                        params: [[[file.dir, file.name]]],
                        success: function () {
                            w2ui['editor_main_toolbar'].set('rebuild_page', {disabled: self._editor === null});
                            if(self.previewMode() == 'render') {
                                self.updatePreview();
                            }
                        },
                        error: function (e) {
                            w2ui['editor_main_toolbar'].set('rebuild_page', {disabled: self._editor === null});
                            showError(e);
                        }
                    });
                });
            }
        },

        getFormat: function (filename) {
            var dot = filename.lastIndexOf('.');

            /* >0 because of dotfiles */
            if (dot > 0) {
                return filename.substring(dot + 1);
            } else {
                return '';
            }
        },

        findEditor: function (mode) {
            return this._editors[mode] || this._editors[''];
        },

        close: function(success) {
            var self = this;

            function _close() {
                w2ui['editor_main_toolbar'].disable('rebuild_page');
                w2ui['editor_right_toolbar'].disable('update_preview');
                $(w2ui['editor'].el('main')).empty();
                self._editor.close();
                self._editor = null;
                self._currentFormat = null;
                self._currentFile = null;
                self.dirty(false);
                self.updatePreview();
                success && success();
            }

            if (this._editor !== null) {
                if(this.dirty()) {
                    $().w2popup({
                        title: 'Confirm close',
                        width: 450,
                        height: 220,
                        body: '<div class="w2ui-centered w2ui-confirm-msg" style="font-size: 13px;">' +
                              '<p>The content of the currently opened file has changed.</p>' +
                              '<p>Are you sure you want to close this file?</p></div>',
                        buttons: '<button value="save" class="w2ui-popup-btn w2ui-btn px-confirm-close" style="width: 80px; margin: 0 10px">Save</button>' +
                                 '<button value="discard" class="w2ui-popup-btn w2ui-btn px-confirm-close" style="width: 80px; margin: 0 10px">Discard</button>' +
                                 '<button value="cancel" class="w2ui-popup-btn w2ui-btn px-confirm-close" style="width: 80px; margin: 0 10px">Cancel</button>',
                        onOpen: function() {
                            setTimeout(function() {
                                $('.px-confirm-close').on('click', function(event) {
                                    var result=$(event.target).val();

                                    w2popup.close();

                                    if(result == 'save') {
                                        self.save(function () {
                                            _close();
                                        });
                                    } else if(result == 'discard')
                                        _close();
                                });
                            }, 0);
                        }
                    });
                } else {
                    _close();
                }
            } else {
                success && success();
            }
        },

        load: function (file) {
            var self = this,
                mode = this.getFormat(file.name),
                editor = this.findEditor(mode);

            if (editor === undefined) {
                w2alert('No editor is registered for this file type.', 'Unknown file type');
                return;
            }

            this.close(function() {
                jQuery.jsonRPC.request('get_content', {
                    params: [file.dir, file.name],
                    success: function (result) {
                        self._editor = new editor(self, w2ui['editor'].el('main'), result.result);
                        self._currentFormat = mode;
                        self._currentFile = file;
                        w2ui['editor_main_toolbar'].enable('rebuild_page');
                        w2ui['editor_right_toolbar'].enable('update_preview');
                        self.updatePreview();
                    },
                    error: showError
                });
            });
        },

        save: function (success) {
            var self = this;

            this.dirty(false);

            if(this._editor) {
                jQuery.jsonRPC.request('set_content', {
                    params: [this._currentFile.dir, this._currentFile.name, this._editor.content()],
                    success: function() { success && success() },
                    error: function (e) {
                        self.dirty(true);
                        showError(e);
                    }
                });
            } else {
                success && success();
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
                }, this.previewDelay);
            }
        },

        updatePreview: function () {
            if(this.previewMode() != 'render') {
                var content = this._editor && this._editor.content(),
                    preview = jQuery('#preview');

                if (content) {
                    jQuery.jsonRPC.request('render', {
                        params: [this._currentFormat, content],
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
                if(this._currentFile && this._currentFile.url) {
                    var file=this._currentFile,
                        old_frame=$('#render'),
                        new_frame = $('<iframe>').appendTo(old_frame.parent());

                    new_frame.one('load', function () {
                        try {
                            // Try to preserve the old scroll position.
                            var old_doc = old_frame.contents();
                            if (old_doc.prop('location') == file.url) {
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
                    }).attr('src', file.url);
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

    Pelicide.registerEditor = function (editor) {
        for (var i = 0; i < editor.formats.length; ++i) {
            Pelicide.prototype._editors[editor.formats[i]] = editor;
        }
    };

    return Pelicide;
});

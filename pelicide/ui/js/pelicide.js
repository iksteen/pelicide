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
            this.initLayout(box);
            this.initSidebar();
            this.initEditorLayout();

            setTimeout(jQuery.proxy(function () {
                this.previewMode('draft');
                this.loadProject();
            }, this), 0);
        },

        initLayout: function (box) {
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
                                    onClick: jQuery.proxy(this.loadProject, this)
                                },
                                {
                                    type: 'button',
                                    id: 'rebuild',
                                    icon: 'fa fa-wrench',
                                    hint: 'Rebuild project',
                                    onClick: jQuery.proxy(this.rebuildProject, this)
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
                onDblClick: jQuery.proxy(function (e) {
                    var file = this._content[e.target];
                    if (file !== undefined) {
                        this.load(file);
                    }
                }, this)
            }));
        },

        initEditorLayout: function () {
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
                                    onClick: jQuery.proxy(this.toggleSidebar, this)
                                },
                                {type: 'break'},
                                {
                                    type: 'button',
                                    id: 'save',
                                    disabled: true,
                                    icon: 'fa fa-save',
                                    hint: 'Save',
                                    onClick: jQuery.proxy(function() { this.save(); }, this)
                                },
                                {
                                    type: 'button',
                                    id: 'rebuild_page',
                                    icon: 'fa fa-wrench',
                                    hint: 'Rebuild page',
                                    disabled: true,
                                    onClick: jQuery.proxy(this.rebuildPage, this)
                                },
                                {type: 'spacer'},
                                {
                                    type: 'check',
                                    id: 'preview',
                                    icon: 'fa fa-eye',
                                    hint: 'Toggle preview',
                                    checked: true,
                                    onClick: jQuery.proxy(this.togglePreview, this)
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
                                    onClick: jQuery.proxy(function () {
                                        this.previewMode('draft');
                                    }, this)
                                },
                                {
                                    type: 'radio',
                                    id: 'render',
                                    group: '1',
                                    caption: 'Render',
                                    onClick: jQuery.proxy(function () {
                                        this.previewMode('render');
                                    }, this)
                                },
                                {type: 'break'},
                                {
                                    type: 'button',
                                    id: 'update_preview',
                                    icon: 'fa fa-refresh',
                                    hint: 'Refresh',
                                    disabled: true,
                                    onClick: jQuery.proxy(this.updatePreview, this)
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

        toggleSidebar: function (event) {
            w2ui['layout'].toggle('left');
        },

        togglePreview: function (event) {
            w2ui['editor'].toggle('right');
        },

        loadProject: function () {
            var sidebar = w2ui['sidebar'],
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

            function addContentNodes(content, parent, files, check) {
                /* Sort paths */
                var paths = [];
                jQuery.each(files, function (i, file) {
                    if (jQuery.inArray(file.dir, paths) == -1)
                        paths.push(file.dir);
                });
                paths.sort(function (a, b) {
                    var i = 0,
                        n = Math.min(a.length, b.length);

                    for (i = 0; i < n; ++i) {
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

                    content[id] = file;
                    sidebar.add(path_node, {
                        id: id,
                        text: file.name,
                        icon: 'fa fa-file-text-o',
                        disabled: !check(file.name)
                    });
                });
            }

            this.close(jQuery.proxy(function () {
                sidebar.lock('Loading...', true);

                this._content = {};
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
                    success: jQuery.proxy(function (result) {
                        var files = {
                                articles: [],
                                pages: [],
                                other: []
                            },
                            content = this._content;

                        jQuery.each(result.result, function (i, file) {
                            if(file.type == 'pelican.contents.Article')
                                files.articles.push(file);
                            else if(file.type == 'pelican.contents.Page')
                                files.pages.push(file);
                            else
                                files.other.push(file);
                        });

                        var check = jQuery.proxy(function (filename) {
                            return this.findEditor(this.getFormat(filename)) !== undefined;
                        }, this);

                        jQuery.each(['articles', 'pages', 'other'], function (i, type) {
                            addContentNodes(
                                content,
                                type,
                                files[type],
                                check
                            );
                        });

                        sidebar.unlock();
                    }, this),
                    error: showError
                });
            }, this));
        },

        rebuildProject: function () {
            w2ui['layout_left_toolbar'].disable('rebuild');

            this.save(jQuery.proxy(function() {
                jQuery.jsonRPC.request('build', {
                    success: jQuery.proxy(function () {
                        w2ui['layout_left_toolbar'].enable('rebuild');
                        if (this.previewMode() == 'render')
                            this.updatePreview();
                    }, this),
                    error: function (e) {
                        w2ui['layout_left_toolbar'].enable('rebuild');
                        showError(e);
                    }
                });
            }, this));
        },

        rebuildPage: function () {
            var file = this._currentFile;
            w2ui['editor_main_toolbar'].disable('rebuild_page');

            if (file && this._editor !== null) {
                this.save(jQuery.proxy(function () {
                    jQuery.jsonRPC.request('build', {
                        params: [[[file.dir, file.name]]],
                        success: jQuery.proxy(function () {
                            w2ui['editor_main_toolbar'].set('rebuild_page', {disabled: this._editor === null});
                            if(this.previewMode() == 'render') {
                                this.updatePreview();
                            }
                        }, this),
                        error: jQuery.proxy(function (e) {
                            w2ui['editor_main_toolbar'].set('rebuild_page', {disabled: this._editor === null});
                            showError(e);
                        }, this)
                    });
                }, this));
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
            var _close = $.proxy(function (){
                w2ui['editor_main_toolbar'].disable('rebuild_page');
                w2ui['editor_right_toolbar'].disable('update_preview');
                $(w2ui['editor'].el('main')).empty();
                this._editor.close();
                this._editor = null;
                this._currentFormat = null;
                this._currentFile = null;
                this.dirty(false);
                this.updatePreview();
                success && success();
            }, this);

            if (this._editor !== null) {
                if(this.dirty()) {
                    var save=$.proxy(this.save, this);

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
                                        save(function () {
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
            var mode = this.getFormat(file.name),
                editor = this.findEditor(mode);

            if (editor === undefined) {
                w2alert('No editor is registered for this file type.', 'Unknown file type');
                return;
            }

            this.close(jQuery.proxy(function() {
                jQuery.jsonRPC.request('get_content', {
                    params: [file.dir, file.name],
                    success: jQuery.proxy(function (result) {
                        this._editor = new editor(this, w2ui['editor'].el('main'), result.result);
                        this._currentFormat = mode;
                        this._currentFile = file;
                        w2ui['editor_main_toolbar'].enable('rebuild_page');
                        w2ui['editor_right_toolbar'].enable('update_preview');
                        this.updatePreview();
                    }, this),
                    error: showError
                });
            }, this));
        },

        save: function (success) {
            this.dirty(false);

            if(this._editor) {
                jQuery.jsonRPC.request('set_content', {
                    params: [this._currentFile.dir, this._currentFile.name, this._editor.content()],
                    success: function() { success && success() },
                    error: $.proxy(function (e) {
                        this.dirty(true);
                        showError(e);
                    }, this)
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
            if (this.previewMode() == 'draft' && !this._previewPending) {
                this._previewPending = true;
                setTimeout(jQuery.proxy(function () {
                    this._previewPending = false;
                    this.updatePreview();
                }, this), this.previewDelay);
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

            jQuery(el).on('scroll', function () {
                if (!pending) {
                    pending = true;
                    setTimeout(jQuery.proxy(function () {
                        var el = jQuery(this),
                            target = jQuery('#preview_container'),
                            f = el.scrollTop() / (el.prop('scrollHeight') - el.prop('offsetHeight'));
                        target.scrollTop(f * (target.prop('scrollHeight') - target.prop('offsetHeight')));
                        pending = false;
                    }, this), 25);
                }
            });
        },

        register: function(editor) {
            for (var i = 0; i < editor.formats.length; ++i) {
                this._editors[editor.formats[i]] = editor;
            }
        }
    };

    return Pelicide;
});

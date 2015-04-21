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
        _currentPath: null,
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
                        img: 'icon-folder',
                        expanded: true,
                        group: true
                    }
                ],
                onDblClick: jQuery.proxy(function (e) {
                    var path = this._content[e.target];
                    if (path !== undefined) {
                        this.load(path);
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
            w2ui['editor_main_toolbar'].set('save', {disabled: self._editor === null || !dirty});
        },

        toggleSidebar: function (event) {
            w2ui['layout'].toggle('left');
        },

        togglePreview: function (event) {
            w2ui['editor'].toggle('right');
        },

        loadProject: function () {
            var sidebar = w2ui['sidebar'],
                nodes = sidebar.find('content', {}),
                i;
            for (i = 0; i < nodes.length; ++i) {
                sidebar.remove(nodes[i].id);
            }
            sidebar.lock('Loading...', true);

            this._content = {};

            function sortNodes(a, b) {
                if (a.type == b.type) {
                    return (a.name < b.name) ? -1 : (a.name > b.name) ? 1 : 0;
                } else if (a.type === 'object') {
                    return -1;
                } else {
                    return 1;
                }
            }

            function addContentNodes(content, parent, nodes, check) {
                var sorted_nodes = [];
                for (var prop in nodes) {
                    if (nodes.hasOwnProperty(prop)) {
                        sorted_nodes.push({
                            name: prop,
                            type: typeof(nodes[prop]),
                            data: nodes[prop]
                        });
                    }
                }
                sorted_nodes.sort(sortNodes);

                for (var i = 0; i < sorted_nodes.length; ++i) {
                    var node = sorted_nodes[i],
                        node_id = parent + '-' + i;

                    if (node.type === 'string') {
                        content[node_id] = node.data;
                        sidebar.add(
                            parent,
                            {
                                id: node_id,
                                text: node.name,
                                icon: 'fa fa-file-text-o',
                                disabled: !check(node)
                            }
                        );
                    } else {
                        sidebar.add(
                            parent,
                            {
                                id: node_id,
                                text: node.name,
                                icon: 'fa fa-folder-o'
                            }
                        );
                        addContentNodes(content, node_id, node.data, check);
                    }
                }
            }

            jQuery.jsonRPC.request('get_settings', {
                success: function (result) {
                    if (result.result['SITENAME']) {
                        document.title = result.result['SITENAME'] + ' (Pelicide)';
                        sidebar.set('content', {
                            text: result.result['SITENAME']
                        });
                    }
                },
                error: showError
            });

            jQuery.jsonRPC.request('list_content', {
                success: jQuery.proxy(function (result) {
                    addContentNodes(this._content, 'content', result.result, jQuery.proxy(function (node) {
                        return this.findEditor(this.getFormat(node.name)) !== undefined;
                    }, this));
                    sidebar.unlock();
                }, this),
                error: showError
            });
        },

        rebuildProject: function () {
            w2ui['layout_left_toolbar'].disable('rebuild');

            jQuery.jsonRPC.request('build', {
                success: function () {
                    w2ui['layout_left_toolbar'].enable('rebuild');
                },
                error: jQuery.proxy(function (e) {
                    w2ui['layout_left_toolbar'].enable('rebuild');
                    showError(e);
                }, this)
            });
        },

        getFormat: function (path) {
            var filename = path.split('/').pop(),
                dot = filename.lastIndexOf('.');

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
                $(w2ui['editor'].el('main')).empty();
                this._editor.close();
                this._editor = null;
                this._currentFormat = null;
                this._currentPath = null;
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

        load: function (path) {
            var mode = this.getFormat(path),
                editor = this.findEditor(mode);

            if (editor === undefined) {
                w2alert('No editor is registered for this file type.', 'Unknown file type');
                return;
            }

            this.close(jQuery.proxy(function() {
                jQuery.jsonRPC.request('get_content', {
                    params: [path],
                    success: jQuery.proxy(function (result) {
                        this._editor = new editor(this, w2ui['editor'].el('main'), result.result);
                        this._currentFormat = mode;
                        this._currentPath = path;
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
                    params: [this._currentPath, this._editor.content()],
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
                    w2ui['editor_right_toolbar'].enable('update_preview');
                    w2ui['editor'].content('right', '<iframe id="render" src="/site/index.html"></iframe>');
                } else {
                    w2ui['editor_right_toolbar'].disable('update_preview');
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
                $('#render')[0].contentWindow.location.reload(true);
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

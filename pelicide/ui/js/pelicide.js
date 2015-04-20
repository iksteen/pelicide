define([
    'jquery',
    'jquery_jsonrpc',
    'w2ui'
], function(jQuery, _, _) {
    function Pelicide() {
    }

    Pelicide.prototype = {
        previewDelay: 50,
        _editors: {},
        _content: {},
        _editor: null,
        _currentFormat: null,
        _currentPath: null,
        _previewPending: false,

        run: function (box) {
            this.initLayout(box);
            this.initSidebar();
            this.initEditorLayout();

            setTimeout(jQuery.proxy(function () {
                this.setPreviewMode('preview');
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
                                    onClick: jQuery.proxy(this.loadProject, this)
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
                                    onClick: jQuery.proxy(this.save, this)
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
                                    id: 'preview',
                                    group: '1',
                                    caption: 'Preview',
                                    checked: true
                                },
                                {
                                    type: 'radio',
                                    id: 'render',
                                    group: '1',
                                    caption: 'Render'
                                }
                            ],
                            onClick: jQuery.proxy(function (event) {
                                this.setPreviewMode(event.target);
                            }, this)
                        }
                    }
                ]
            });

            w2ui['layout'].content('main', w2ui['editor']);
        },

        dirty: function(dirty) {
            if(dirty === undefined) {
                return !w2ui['editor_main_toolbar'].get('save')['disabled'];
            } else {
                w2ui['editor_main_toolbar'].set('save', {disabled: !dirty || self._editor === null});
            }
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
                                icon: 'fa fa-folder-o',
                                expanded: true
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
                }
            });

            jQuery.jsonRPC.request('list_content', {
                success: jQuery.proxy(function (result) {
                    addContentNodes(this._content, 'content', result.result, jQuery.proxy(function (node) {
                        return this.findEditor(this.getFormat(node.name)) !== undefined;
                    }, this));
                    sidebar.unlock();
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

        close: function() {
            if (this._editor !== null) {
                $(w2ui['editor'].el('main')).empty();
                this._editor.close();
                this._editor = null;
                this._currentFormat = null;
                this._currentPath = null;
                this.dirty(false);
                this.updatePreview();
            }
        },

        load: function (path) {
            var mode = this.getFormat(path),
                editor = this.findEditor(mode);

            if (editor === undefined) {
                w2alert('No editor is registered for this file type.', 'Unknown file type');
                return;
            }

            this.close();

            jQuery.jsonRPC.request('get_content', {
                params: [path],
                success: jQuery.proxy(function (result) {
                    this._editor = new editor(this, w2ui['editor'].el('main'), result.result);
                    this._currentFormat = mode;
                    this._currentPath = path;
                    this.updatePreview();
                }, this),
                error: function (e) {
                    if(e.error && e.error.message)
                        w2alert('Error: ' + e.error.message);
                    else
                        w2alert('Error: ' + e);
                }
            });
        },

        save: function () {
            this.dirty(false);

            if(this._editor) {
                jQuery.jsonRPC.request('set_content', {
                    params: [this._currentPath, this._editor.content()],
                    error: $.proxy(function (e) {
                        this.dirty(true);

                        if(e.error && e.error.message)
                            w2alert('Error: ' + e.error.message);
                        else
                            w2alert('Error: ' + e);
                    }, this)
                });
            }
        },

        setPreviewMode: function (mode) {
            if (mode == 'render') {
                w2ui['editor'].content('right', '<iframe id="render" src="/site/index.html"></iframe>');
            } else {
                w2ui['editor'].content('right', '<div id="preview_container"><div id="preview"></div></div>');
                this.updatePreview();
            }
        },

        schedulePreview: function () {
            if (!this._previewPending) {
                this._previewPending = true;

                setTimeout(jQuery.proxy(function () {
                    this._previewPending = false;
                    this.updatePreview();
                }, this), this.previewDelay);
            }
        },

        updatePreview: function () {
            var content = this._editor && this._editor.content();
            if (content) {
                jQuery.jsonRPC.request('render', {
                    params: [this._currentFormat, content],
                    success: function (result) {
                        jQuery('#preview').html(result.result);
                    }
                })
            } else {
                jQuery('#preview').html('');
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

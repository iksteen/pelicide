$(function() {
    $.jsonRPC.setup({
        endPoint: '/rpc'
    });

    function Pelicide() {
        this.previewDelay = 50;
        this.init();
    }

    Pelicide.prototype = {
        _currentFormat: null,
        _currentPath: null,
        _previewPending: false,

        init: function() {
            this._content = {};
            this._editors = {};
            this._editor = null;

            this.initLayout();
            this.initSidebar();
            this.initEditorLayout();

            setTimeout($.proxy(function() {
                this.setPreviewMode('preview');
                this.loadProject();
            }, this), 0);
        },

        initLayout: function() {
            $('#main_layout').w2layout({
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
                                    onClick: $.proxy(this.loadProject, this)
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

        initSidebar: function() {
            w2ui['layout'].content('left', $().w2sidebar({
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
                onDblClick: $.proxy(function(e) {
                    var path = this._content[e.target];
                    if(path !== undefined) {
                        this.load(path);
                    }
                }, this)
            }));
        },

        initEditorLayout: function() {
            $().w2layout({
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
                                    onClick: $.proxy(this.toggleSidebar, this)
                                },
                                { type: 'spacer' },
                                {
                                    type: 'check',
                                    id: 'preview',
                                    icon: 'fa fa-eye',
                                    hint: 'Toggle preview',
                                    checked: true,
                                    onClick: $.proxy(this.togglePreview, this)
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
                            onClick: $.proxy(function(event) {
                                this.setPreviewMode(event.target);
                            }, this)
                        }
                    }
                ]
            });

            w2ui['layout'].content('main', w2ui['editor']);
        },

        initEditor: function(path, mode, editor, content) {
            var panel=$('#layout_editor_panel_main').find('> .w2ui-panel-content');
            panel.empty();

            if(this._editor !== null) {
                this._editor.close();
                this._editor = null;
                this._currentFormat = null;
                this._currentPath = null;
            }

            this._editor = new editor(this, panel[0], content);
            this._currentFormat = mode;
            this._currentPath = path;
        },

        toggleSidebar: function(event) {
            w2ui['layout'].toggle('left');
        },

        togglePreview: function(event) {
            w2ui['editor'].toggle('right');
        },

        loadProject: function() {
            var sidebar = w2ui['sidebar'],
                nodes = sidebar.find('content', {}),
                i;
            for(i=0; i<nodes.length; ++i) {
                sidebar.remove(nodes[i].id);
            }
            sidebar.lock('Loading...', true);

            this._content = {};

            function sortNodes(a, b) {
                if(a.type == b.type) {
                    return (a.name < b.name) ? -1 : (a.name > b.name) ? 1 : 0;
                } else if(a.type === 'object') {
                    return -1;
                } else {
                    return 1;
                }
            }

            function addContentNodes(content, parent, nodes, check) {
                var sorted_nodes=[];
                for(var prop in nodes) {
                    if(nodes.hasOwnProperty(prop)) {
                        sorted_nodes.push({
                            name: prop,
                            type: typeof(nodes[prop]),
                            data: nodes[prop]
                        });
                    }
                }
                sorted_nodes.sort(sortNodes);

                for(var i=0; i<sorted_nodes.length; ++i) {
                    var node=sorted_nodes[i],
                        node_id = parent + '-' + i;

                    if(node.type === 'string') {
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

            $.jsonRPC.request('get_settings', {
                success: function(result) {
                    if(result.result['SITENAME']) {
                        document.title = result.result['SITENAME'] + ' (Pelicide)';
                        sidebar.set('content', {
                            text: result.result['SITENAME']
                        });
                    }
                }
            });

            $.jsonRPC.request('list_content', {
                success: $.proxy(function(result) {
                    addContentNodes(this._content, 'content', result.result, $.proxy(function(node) {
                        return this.findEditor(this.getFormat(node.name)) !== undefined;
                    }, this));
                    sidebar.unlock();
                }, this)
            });
        },

        getFormat: function(path) {
            var filename=path.split('/').pop(),
                dot=filename.lastIndexOf('.');

            /* >0 because of dotfiles */
            if(dot > 0) {
                return filename.substring(dot + 1);
            } else {
                return '';
            }
        },

        findEditor: function(mode) {
            return this._editors[mode] || this._editors[''];
        },

        load: function(path) {
            var mode=this.getFormat(path),
                editor = this.findEditor(mode);

            if(editor === undefined) {
                w2alert('No editor is registered for this file type.', 'Unknown file type');
                return;
            }

            $.jsonRPC.request('get_content', {
                params: [path],
                success: $.proxy(function (result) {
                    this.initEditor(path, mode, editor, result.result);
                    this.updatePreview();
                }, this),
                error: function (e) {
                    alert('error:' + e);
                }
            });
        },

        setPreviewMode: function(mode) {
            if(mode == 'render') {
                w2ui['editor'].content('right', '<iframe id="render" src="/site/index.html"></iframe>');
            } else {
                w2ui['editor'].content('right', '<div id="preview_container"><div id="preview"></div></div>');
                this.updatePreview();
            }
        },

        schedulePreview: function() {
            if(! this._previewPending) {
                this._previewPending = true;

                setTimeout($.proxy(function() {
                    this._previewPending = false;
                    this.updatePreview();
                }, this), this.previewDelay);
            }
        },

        updatePreview: function() {
            var content = this._editor && this._editor.content();
            if(content) {
                $.jsonRPC.request('render', {
                    params: ['markdown', content],
                    success: function(result) {
                        $('#preview').html(result.result);
                    }
                })
            } else {
                $('#preview').html('');
            }
        },

        setUpPreviewScrollSync: function(el) {
            var pending = false;

            $(el).on('scroll', function() {
                if(! pending) {
                    pending = true;
                    setTimeout($.proxy(function() {
                        var el = $(this),
                            target = $('#preview_container'),
                            f = el.scrollTop() / (el.prop('scrollHeight') - el.prop('offsetHeight'));
                        target.scrollTop(f * (target.prop('scrollHeight') - target.prop('offsetHeight')));
                        pending = false;
                    }, this), 25);
                }
            });
        },

        addEditor: function(editor, modes) {
            for(var i=0; i<modes.length; ++i) {
                this._editors[modes[i]] = editor;
            }
        }
    };

    function CodeMirrorEditor(pelicide, parent_el, content) {
        /* Set up CodeMirror */
        this._codeMirror = CodeMirror(
            parent_el,
            {
                value: content,
                lineWrapping: true,
                mode: this.mode,
                theme: 'cobalt'
            }
        );
        if(CodeMirror.autoLoadMode !== undefined)
            CodeMirror.autoLoadMode(this._codeMirror, this.mode);

        // Schedule preview update on content changes
        this._codeMirror.on('change', $.proxy(pelicide.schedulePreview, pelicide));

        // Sync preview scrolling
        pelicide.setUpPreviewScrollSync(this._codeMirror.getScrollerElement());
    }

    CodeMirrorEditor.prototype = {
        mode: 'text/plain',
        close: function() {
            this._codeMirror = null;
        },

        content: function() {
            return this._codeMirror.getValue();
        }
    };

    function MarkdownEditor(pelicide, parent_el, content) {
        CodeMirrorEditor.call(this, pelicide, parent_el, content);
    }
    MarkdownEditor.prototype = Object.create(CodeMirrorEditor.prototype);
    $.extend(
        MarkdownEditor.prototype,
        {
            constructor: MarkdownEditor,
            mode: 'markdown'
        }
    );
    MarkdownEditor.register = function(pelicide) {
        pelicide.addEditor(MarkdownEditor, ['md', 'markdown', 'mdown']);
    };

    CodeMirror.modeURL = 'components/codemirror/mode/%N/%N.js';

    var pelicide = new Pelicide();
    MarkdownEditor.register(pelicide);
});

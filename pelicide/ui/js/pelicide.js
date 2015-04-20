$(function() {
    $.jsonRPC.setup({
        endPoint: '/rpc'
    });

    function Pelicide() {
        this.previewDelay = 50;
        this.init();
    }

    Pelicide.prototype = {
        _previewPending: false,
        _pendingPreviewScroll: false,

        init: function() {
            this._content = {};

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

        initEditor: function(mode, content) {
            var panel=$('#layout_editor_panel_main').find('> .w2ui-panel-content');

            if(this._codeMirror !== null) {
                this._codeMirror = null;
                panel.empty();
            }

            this._codeMirror = CodeMirror(
                panel[0],
                {
                    value: content,
                    lineWrapping: true,
                    mode: mode,
                    theme: 'cobalt'
                }
            );

            this._codeMirror.on('change', $.proxy(this.schedulePreview, this));

            $('.CodeMirror-scroll').on('scroll', $.proxy(function() {
                if(! this._pendingPreviewScroll) {
                    this._pendingPreviewScroll = true;

                    setTimeout($.proxy(function() {
                        var viewport=$('.CodeMirror-scroll'),
                            target=$('#preview_container'),
                            f = viewport.scrollTop() / (viewport.prop('scrollHeight') - viewport.prop('offsetHeight'));
                        this._pendingPreviewScroll = false;
                        target.scrollTop(f * (target.prop('scrollHeight') - target.prop('offsetHeight')));
                    }, this), 25);
                }
            }, this));
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

            function addContentNodes(content, parent, nodes) {
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
                                icon: 'fa fa-file-text-o'
                            }
                        )
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
                        addContentNodes(content, node_id, node.data);
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
                    addContentNodes(this._content, 'content', result.result);
                    sidebar.unlock();
                }, this)
            });
        },

        load: function(filename) {
            $.jsonRPC.request('get_content', {
                params: [filename],
                success: $.proxy(function (result) {
                    this.initEditor('markdown', result.result);
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
            var content = this._codeMirror && this._codeMirror.getValue();
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
        }
    };

    new Pelicide();
});

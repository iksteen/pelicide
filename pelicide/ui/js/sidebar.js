define([
    'jquery',
    'w2ui'
], function(jQuery) {
    function Sidebar(pelicide) {
        this.pelicide = pelicide;

        this._id = 0;
        this._paths = {};
        this._content = {};
    }

    Sidebar.prototype = {
        create: function() {
            this._sidebar = jQuery().w2sidebar({
                name: 'sidebar',
                nodes: [
                    {
                        id: 'content',
                        text: 'Content',
                        expanded: true,
                        group: true
                    }
                ],
                onDblClick: jQuery.proxy(function (event) {
                    var file = this._content[event.target];
                    if (file !== undefined) {
                        this.pelicide.load(file);
                    }
                }, this)
            });

            this.clear();

            return this._sidebar;
        },

        lock: function(/* arguments */) {
            this._sidebar.lock.apply(this._sidebar, arguments);
        },

        unlock: function(/* arguments */) {
            this._sidebar.unlock.apply(this._sidebar, arguments);
        },

        _newId: function() {
            return 'node_' + (++this._id);
        },

        clear: function() {
            this._paths = {
                nodes: {
                    content: {
                        id: 'content',
                        nodes: {}
                    }
                }
            };
            this._content = {};

            var contentChildren=this._sidebar.find({
                parent: this._sidebar.get('content')
            });
            for(var i = 0; i < contentChildren.length; ++i) {
                var node = contentChildren[i];

                /* Remove all nodes below the content type node. */
                this._sidebar.remove.apply(
                    this._sidebar,
                    this._sidebar.find(node, {}).map(function (e) {
                        return e.id;
                    })
                );

                /* Re-register path for the content type node. */
                this._paths.nodes.content.nodes[node.id] = {
                    id: node.id,
                    nodes: {}
                }
            }
        },

        contentTitle: function(text) {
            var content = this._sidebar.get('content');

            if(text === undefined)
                return content.text;

            content.text = (text === null) ? 'Content' : text;
            this._sidebar.refresh('content');

        },

        addContentType: function(text) {
            var id = this._newId();

            this._sidebar.add('content', {
                id: id,
                text: text,
                icon: 'fa fa-folder'
            });

            this._paths.nodes.content.nodes[id] = {
                id: id,
                nodes: {}
            };

            return id;
        },

        ensurePath: function (path) {
            var node = this._paths;

            for(var i = 0; i < path.length; ++i) {
                var el = path[i];

                if (node.nodes.hasOwnProperty(el)) {
                    node = node.nodes[el];
                } else {
                    var id = this._newId();

                    this._sidebar.add(node.id, {
                        id: id,
                        text: el,
                        icon: 'fa fa-folder-o'
                    });

                    node = node.nodes[el] = {
                        id: id,
                        nodes: {}
                    };
                }
            }

            return node.id;
        },

        addFile: function(path, file, icon) {
            var parent = this.ensurePath(path),
                id = this._newId();

            this._sidebar.add(parent, {
                id: id,
                text: file.name,
                icon: 'fa fa-file-text-o',
                disabled: !this.pelicide.findEditor(this.pelicide.getFormat(file.name))
            });

            this._content[id] = file;

            return id;
        }
    };

    return Sidebar;
});
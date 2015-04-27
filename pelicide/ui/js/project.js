define([
    'js/util',
    'js/api',
    'jquery',
    'w2ui'
], function(Util, API, jQuery) {
    function Project(pelicide, options) {
        options = jQuery.extend({sitename: '', contentTypes: []}, options);

        this.pelicide = pelicide;
        this._sitename = options.sitename;
        this.handlers = [];
        this._sidebar = null;
        this._box = null;
        this._toolbar = null;

        this._contentTypes = [];
        for (var i = 0; i < options.contentTypes.length; ++i)
            this._contentTypes.push(new options.contentTypes[i](this));

        this._id = 0;
        this._paths = {};
        this._content = {};
        this._files = {};

        this._otherContentId = null;
    }

    Project.prototype = {
        layout: function() {
            var self = this;

            return {
                toolbar: {
                    items: [
                        {
                            type: 'button',
                            id: 'refresh',
                            icon: 'fa fa-refresh',
                            hint: 'Reload project',
                            onClick: function () { self.reload().catch(Util.alert); }
                        },
                        {
                            type: 'button',
                            id: 'rebuild',
                            icon: 'fa fa-wrench',
                            hint: 'Rebuild project',
                            onClick: function () { self.rebuild().catch(Util.alert); }
                        },
                        { type: 'break' },
                        {
                            type: 'menu',
                            id: 'create',
                            icon: 'fa fa-plus',
                            disabled: true,
                            hint: 'Create content',
                            items: []
                        }
                    ]
                }
            };
        },

        render: function(box, toolbar) {
            var self = this;

            this._box = box;
            this._toolbar = toolbar;

            this._sidebar = jQuery().w2sidebar({
                name: 'project',
                nodes: [
                    {
                        id: 'content',
                        text: this._sitename || 'Content',
                        expanded: true,
                        group: true
                    }
                ],
                onDblClick: function (event) {
                    var file = self._content[event.target];
                    if (file !== undefined) {
                        self.pelicide.editor.open(file).catch(Util.alert);
                    }
                }
            });
            this._sidebar.render(box);

            this.clear();

            /* Initialise content type plugins. */
            for(var i = 0; i < this._contentTypes.length; ++i) {
                this._contentTypes[i].init();
            }
            this._otherContentId = this.addContentType('Other');

            /* Connect click event for create content menu. */
            this._toolbar.on('click', function (e) {
                if(e.item && e.item.type == 'menu' && e.subItem && e.subItem.onClick) {
                    e.subItem.onClick(e);
                }}
            );

            /* Select node after opening a file. */
            this.pelicide.editor.on({type: 'open', execute: 'after'}, function (e) { self.select(e.file); });

            this.reload().catch(Util.alert);
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
            this._files = {};

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

        addCreateContent: function(item) {
            var id = this._newId(),
                items = this._toolbar.get('create').items;

            items.push(jQuery.extend({}, item, { id: id }));
            this._toolbar.set('create', {
                disabled: false,
                items: items
            });
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
                disabled: !this.pelicide.editor.getEditor(file.name)
            });

            this._content[id] = file;
            this._files[file.dir.concat([file.name]).join('/')] = id;

            return id;
        },

        getFile: function(dir, filename) {
            return this._content[this._files[dir.concat([filename]).join('/')]];
        },

        categories: function () {
            var categories = [];
            jQuery.each(this._content, function (k, file) {
                if (jQuery.inArray(file.meta.category, categories) === -1) {
                    categories.push(file.meta.category);
                }
            });
            return categories;
        },

        select: function (file) {
            var node = this._files[file.dir.concat([file.name]).join('/')];
            this._sidebar.expandParents(node);
            this._sidebar.select(node);
        },

        reload: function () {
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
                    self.addFile(item.path, item.file);
                }
            }

            return this.pelicide.editor.close()
                .then(function () {
                    self._sidebar.lock('Loading...', true);
                    self.clear();
                    return API.list_content();
                })
                .then(function (content) {
                    var items = [];

                    for (var i = 0; i < content.length; ++i) {
                        var file = content[i];

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

                    self._sidebar.unlock();
                }, function (e) {
                    self._sidebar.unlock();
                    return Promise.reject(e);
                });
        },

        rebuild: function () {
            var self = this;

            this._toolbar.disable('rebuild');

            var eventData = {
                type: 'rebuild',
                phase: 'before',
                target: this,
                onComplete: function () {
                    self._toolbar.enable('rebuild');
                }
            };
            this.trigger(eventData);
            if (eventData.isCancelled === true) {
                eventData.onComplete();
                return Promise.reject();
            }

            return this.pelicide.editor.save()
                .then(function () { return API.build(); })
                .then(function () {
                    self.trigger(jQuery.extend(eventData, { phase: 'after', success: true }));
                }, function (e) {
                    self.trigger(jQuery.extend(eventData, { phase: 'after', success: false, error: e }));
                });
        }
    };
    jQuery.extend(Project.prototype, w2utils.event);

    return Project;
});

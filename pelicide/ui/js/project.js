define([
    'js/util',
    'jquery',
    'w2ui'
], function(Util, jQuery) {
    function Project(pelicide, contentTypes) {
        this.pelicide = pelicide;

        this.handlers = [];
        this._sidebar = null;
        this._box = null;
        this._toolbar = null;

        this._contentTypes = [];
        for (var i = 0; i < contentTypes.length; ++i)
            this._contentTypes.push(new contentTypes[i](this));

        this._id = 0;
        this._paths = {};
        this._content = {};
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
                            onClick: function () { self.reload(); }
                        },
                        {
                            type: 'button',
                            id: 'rebuild',
                            icon: 'fa fa-wrench',
                            hint: 'Rebuild project',
                            onClick: function () { self.rebuild(); }
                        }
                    ]
                }
            };
        },

        render: function(box, toolbar) {
            this._box = box;
            this._toolbar = toolbar;

            this._sidebar = jQuery().w2sidebar({
                name: 'project',
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
                        this.pelicide.editor.open(file);
                    }
                }, this)
            });
            this._sidebar.render(box);

            this.clear();

            /* Initialise content type plugins. */
            for(var i = 0; i < this._contentTypes.length; ++i) {
                this._contentTypes[i].init();
            }
            this._otherContentId = this.addContentType('Other');

            this.reload();
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
                disabled: !this.pelicide.editor.getEditor(file.name)
            });

            this._content[id] = file;

            return id;
        },

        reload: function (success) {
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

            this.pelicide.editor.close(function () {
                self._sidebar.lock('Loading...', true);
                self.clear();

                jQuery.jsonRPC.request('get_settings', {
                    success: function (result) {
                        if (result.result['SITENAME']) {
                            document.title = result.result['SITENAME'] + ' (Pelicide)';
                            self.contentTitle(result.result['SITENAME']);
                        }
                    },
                    error: function (e) {
                        self.contentTitle(null);
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

                        self._sidebar.unlock();

                        success && success();
                    },

                    error: function (e) {
                        self._sidebar.unlock();
                        Util.alert(e);
                    }
                });
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
                return;
            }

            this.pelicide.editor.save(function() {
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
        }
    };
    jQuery.extend(Project.prototype, w2utils.event);

    return Project;
});

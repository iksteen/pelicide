define([
    'js/util',
    'js/sidebar',
    'js/editor',
    'js/preview',
    'jquery',
    'jquery_jsonrpc',
    'w2ui'
], function(Util, Sidebar, Editor, Preview, jQuery) {

    function Pelicide(options) {
        options = jQuery.extend({}, {
            previewDelay: 50,
            contentTypes: [],
            editors: []
        }, options);

        this.handlers = [];

        this.sidebar = new Sidebar(this, options.contentTypes);
        this.editor = new Editor(this, options.editors);
        this.preview = new Preview(this, options.previewDelay);
    }

    Pelicide.prototype = {
        run: function (box) {
            var self = this;

            /* Initialise the layout. */
            this.render(box);

            /* Run this as a timeout to allow the DOM to settle. */
            setTimeout(function () {
                /* Initialise the sidebar, editor and preview panel. */
                self.sidebar.render(w2ui['layout'].el('left'), w2ui['layout_left_toolbar']);
                self.editor.render(w2ui['editor'].el('main'), w2ui['editor_main_toolbar']);
                self.preview.render(w2ui['editor'].el('right'), w2ui['editor_right_toolbar']);
            }, 0);
        },

        _ensureToolbarItems: function(layout, items) {
            if (layout.toolbar === undefined) {
                layout.toolbar = { items: [] }
            } else if(layout.toolbar.items === undefined) {
                layout.toolbar.items = [];
            }
            return layout;
        },

        render: function (box) {
            var self = this,
                sidebarLayout = this._ensureToolbarItems(this.sidebar.layout() || {}),
                editorLayout = this._ensureToolbarItems(this.editor.layout() || {}),
                previewLayout = this._ensureToolbarItems(this.preview.layout() || {});

            editorLayout.toolbar.items = [].concat(
                [
                    {
                        type: 'check',
                        id: 'sidebar',
                        icon: 'fa fa-bars',
                        hint: 'Toggle sidebar',
                        checked: true,
                        onClick: function () { self.toggleSidebar(); }
                    },
                    {type: 'break'}
                ],
                editorLayout.toolbar.items,
                [
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
            );

            jQuery(box).w2layout({
                name: 'layout',
                panels: [
                    //{ type: 'left' },
                    jQuery.extend(sidebarLayout, { type: 'left', size: 240, resizable: true }),
                    { type: 'main' }
                ]
            });

            jQuery().w2layout({
                name: 'editor',
                panels: [
                    jQuery.extend({}, editorLayout, { type: 'main', size: '50%' }),
                    jQuery.extend({}, previewLayout, { type: 'right', size: '50%' })
                ]
            });
            w2ui['layout'].content('main', w2ui['editor']);

            return w2ui['layout'];
        },

        toggleSidebar: function () {
            w2ui['layout'].toggle('left');
        },

        togglePreview: function () {
            w2ui['editor'].toggle('right');
        }
    };
    jQuery.extend(Pelicide.prototype, w2utils.event);

    return Pelicide;
});

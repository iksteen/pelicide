import Util from 'js/util'
import Project from 'js/project'
import Editor from 'js/editor'
import Preview from 'js/preview'
import jQuery from 'jquery'
import 'vitmalina/w2ui'

export default class Pelicide {
    constructor(options) {
        Object.assign(this, w2utils.event);

        options = options || {};

        this.handlers = [];

        this.project = new Project(this, options);
        this.editor = new Editor(this, options);
        this.preview = new Preview(this, options);
    }

    run(box) {
        /* Initialise the layout. */
        this.layout().render(box);

        /* Run this as a timeout to allow the DOM to settle. */
        setTimeout(() => {
            /* Initialise the project, editor and preview panel. */
            this.project.render(w2ui['layout'].el('left'), w2ui['layout_left_toolbar']);
            this.editor.render(w2ui['editor'].el('main'), w2ui['editor_main_toolbar']);
            this.preview.render(w2ui['editor'].el('right'), w2ui['editor_right_toolbar']);
        }, 0);
    }

    _ensureToolbarItems(layout) {
        if (layout.toolbar === undefined) {
            layout.toolbar = { items: [] }
        } else if(layout.toolbar.items === undefined) {
            layout.toolbar.items = [];
        }
        return layout;
    }

    layout(box) {
        var projectLayout = this._ensureToolbarItems(this.project.layout() || {}),
            editorLayout = this._ensureToolbarItems(this.editor.layout() || {}),
            previewLayout = this._ensureToolbarItems(this.preview.layout() || {});

        editorLayout.toolbar.items = [].concat(
            [
                {
                    type: 'check',
                    id: 'project',
                    icon: 'fa fa-bars',
                    hint: 'Toggle project view',
                    checked: true,
                    onClick: () => this.toggleProject()
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
                    onClick: () => this.togglePreview()
                }
            ]
        );

        jQuery().w2layout({
            name: 'layout',
            panels: [
                Object.assign({}, projectLayout, { type: 'left', size: 240, resizable: true }),
                { type: 'main' }
            ]
        });

        jQuery().w2layout({
            name: 'editor',
            panels: [
                Object.assign({}, editorLayout, { type: 'main', size: '50%' }),
                Object.assign({}, previewLayout, { type: 'right', size: '50%' })
            ]
        });
        w2ui['layout'].content('main', w2ui['editor']);

        return w2ui['layout'];
    }

    toggleProject() {
        w2ui['layout'].toggle('left');
    }

    togglePreview() {
        w2ui['editor'].toggle('right');
    }
}

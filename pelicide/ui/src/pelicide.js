import Project from 'src/project'
import Editor from 'src/editor'
import Preview from 'src/preview'
import jQuery from 'jquery'
import settings from 'src/settings'
import keypress from 'keypress.js'
import 'vitmalina/w2ui'
import fullscreen from 'fullscreen'
import 'font-awesome/css/font-awesome.min.css!';
import 'vitmalina/w2ui/dist/w2ui.min.css!';
import 'src/css/style.css!';


settings.register(
    {
        name: 'hideProjectAfterOpen',
        defaultValue: true,
        type: 'checkbox',
        html: {
            caption: '&nbsp;',
            text: '&nbsp;Hide project tree after opening a file.'
        }
    },
    {
        name: 'focusFullScreen',
        defaultValue: true,
        type: 'checkbox',
        html: {
            caption: '&nbsp;',
            text: '&nbsp;Go full screen in focus mode.',
            attr: fullscreen.available() ? '' : 'disabled'
        }
    }
);


export default class Pelicide {
    constructor(options) {
        Object.assign(this, w2utils.event);

        options = options || {};

        this.extensions = new Set();
        for (let extension of (options.extensions || []))
            this.extensions.add(extension);
        this.handlers = [];
        this.listener = new keypress.keypress.Listener();
        this._fs = fullscreen(window.document.documentElement);
        this._fsAttained = false;

        this.project = new Project(this, options);
        this.editor = new Editor(this, options);
        this.preview = new Preview(this, options);

        jQuery(window).on('beforeunload', () => this.editor.dirty ?  'You have unsaved changes in your document.' : undefined);
    }

    get metaKey() {
        return navigator.userAgent.indexOf("Mac OS X") === -1 ? 'Ctrl' : 'Cmd';
    }

    listen(key, handler) {
        this.listener.simple_combo(key, handler);
    }

    run(box) {
        /* Initialise the layout. */
        this.layout.render(box);

        this.editor.on({ type: 'open', execute: 'after' }, () => {
            if (settings.get('hideProjectAfterOpen'))
                w2ui['layout'].hide('left');
        });

        /* Set up focus (full screen) mode. */
        this._fs.on('attain', () => { this._onFsAttained(); });
        this._fs.on('release', () => { this._onFsReleased(); });

        /* Set up global hot keys. */
        this.listen('meta shift o', () => { this.toggleProject(); });
        this.listen('meta shift p', () => { this.togglePreview(); });
        this.listen('meta enter', () => { this.toggleFocus(); });

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

    get layout() {
        var projectLayout = this._ensureToolbarItems(this.project.layout || {}),
            editorLayout = this._ensureToolbarItems(this.editor.layout || {}),
            previewLayout = this._ensureToolbarItems(this.preview.layout || {});

        editorLayout.toolbar.items = [].concat(
            [
                {
                    id: 'project',
                    icon: 'fa fa-bars',
                    hint: `Toggle project view (${this.metaKey}-Shift-O)`,
                    onClick: () => this.toggleProject()
                },
                {
                    id: 'focus',
                    icon: 'fa fa-expand',
                    hint: `Toggle focus mode (${this.metaKey}-Enter)`,
                    onClick: () => this.toggleFocus()
                },
                {type: 'break'}
            ],
            editorLayout.toolbar.items,
            [
                {type: 'spacer'},
                {
                    id: 'settings',
                    icon: 'fa fa-cog',
                    hint: 'Settings',
                    onClick: () => { settings.show(); }
                },
                {type: 'break'},
                {
                    id: 'preview',
                    icon: 'fa fa-eye',
                    hint: `Toggle preview (${this.metaKey}-Shift-P)`,
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

        // Trigger layout events when panels are resized.
        w2ui['layout'].on({ type: 'resize', execute: 'after' }, () => this.trigger({ type: 'layout' }));
        w2ui['editor'].on({ type: 'resize', execute: 'after' }, () => this.trigger({ type: 'layout' }));

        return w2ui['layout'];
    }

    toggleProject() {
        w2ui['layout'].toggle('left');
    }

    togglePreview() {
        w2ui['editor'].toggle('right');
    }

    toggleFocus() {
        if (fullscreen.available() && settings.get('focusFullScreen')) {
            if (this._fsAttained)
                this._fs.release();
            else
                this._fs.request();
        } else {
            if (this._fsAttained)
                this._fs.emit('release');
            else
                this._fs.emit('attain');
        }
    }

    _onFsAttained() {
        this._fsAttained = true;
        w2ui['layout'].hideToolbar('left');
        w2ui['editor'].hideToolbar('main');
        w2ui['editor'].hideToolbar('right');
        w2ui['layout'].hide('left', true);
        this.preview.mode = 'draft';
    }

    _onFsReleased() {
        this._fsAttained = false;
        w2ui['layout'].showToolbar('left');
        w2ui['editor'].showToolbar('main');
        w2ui['editor'].showToolbar('right');
        if (!settings.get('hideProjectAfterOpen') || !this.editor.state) {
            w2ui['layout'].show('left', true);
        }
    }
}

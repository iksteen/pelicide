import API from 'src/api'
import {getErrorString, getExtension} from 'src/util'
import jQuery from 'jquery'
import 'vitmalina/w2ui'
import 'src/css/pygments.css!';

export default class Preview {
    constructor(pelicide, {previewDelay: delay = 50}) {
        Object.assign(this, w2utils.event);

        this.pelicide = pelicide;
        this.delay = delay;
        this._mode = null;
        this._pending = false;
    }

    get layout() {
        return {
            overflow: 'hidden',
            toolbar: {
                items: [
                    {
                        type: 'radio',
                        id: 'draft',
                        group: '1',
                        caption: 'Draft',
                        checked: true,
                        onClick: () => { this.mode = 'draft' }
                    },
                    {
                        type: 'radio',
                        id: 'render',
                        group: '1',
                        caption: 'Render',
                        onClick: () => { this.mode = 'render' }
                    },
                    {type: 'break'},
                    {
                        type: 'button',
                        id: 'update_preview',
                        icon: 'fa fa-refresh',
                        hint: 'Refresh',
                        disabled: true,
                        onClick: () => this.update()
                    },
                    {
                        type: 'button',
                        id: 'external_preview',
                        icon: 'fa fa-external-link',
                        hint: 'Open in new window',
                        disabled: true,
                        onClick: () => this.external()
                    }
                ]
            }
        };
    }

    render(box, toolbar) {
        this._box = box;
        this._toolbar = toolbar;

        this.pelicide.editor.on({ type: 'change', execute: 'after' }, () => this.schedule());
        this.pelicide.editor.on({ type: 'open', execute: 'after' }, () => {
            toolbar.enable('update_preview');
            toolbar.enable('external_preview');
            this.update();
        });
        this.pelicide.editor.on({ type: 'close', execute: 'after' }, () => {
            toolbar.disable('update_preview');
            toolbar.disable('external_preview');
            this.update();
        });
        this.pelicide.project.on({ type: 'rebuild', execute: 'after' }, () => {
            if (this.mode == 'render')
                this.update();
        });
        this.pelicide.editor.on({ type: 'rebuild', execute: 'after' }, () => {
            if (this.mode == 'render')
                this.update();
        });

        this.mode = 'draft';
    }

    get mode() {
        return this._mode;
    }

    set mode(mode) {
        setTimeout(() => {
            this._toolbar.check((mode == 'render') ? 'render' : 'draft');
            this._toolbar.uncheck((mode == 'render') ? 'draft' : 'render');
        }, 0);

        if(mode != this._mode) {
            this._mode = mode;

            if (mode == 'render') {
                jQuery(this._box).html('<iframe id="render"></iframe>');
                this.update();
            } else {
                jQuery(this._box).html('<div id="preview_container"><div id="preview"></div></div>');
                this.update();
            }
        }
    }

    schedule() {
        if (this.mode == 'draft' && !this._pending) {
            this._pending = true;
            setTimeout(() => {
                this._pending = false;
                this.update();
            }, this.delay);
        }
    }

    update() {
        var state = this.pelicide.editor.state;

        if(this.mode != 'render') {
            let preview = jQuery('#preview'),
                extension = state && getExtension(state.file.name);

            if (state && this.pelicide.extensions.has(extension)) {
                API.render(extension, state.content).then(html => {
                    preview.html(html);
                }, e => {
                    preview.empty().append(
                        '<h3 style="color: red">Render failed:</h3>',
                        jQuery('<p>').html(getErrorString(e))
                    );
                });
            } else {
                preview.empty();
            }
        } else {
            if(state && state.file.url) {
                let old_frame = jQuery('#render'),
                    new_frame = jQuery('<iframe>').appendTo(old_frame.parent());

                new_frame.one('load', function () {
                    try {
                        // Try to preserve the old scroll position.
                        let old_doc = old_frame.contents();
                        if (old_doc.prop('location') == state.file.url) {
                            let old_body = old_doc.find('body'),
                                top = old_body.scrollTop(),
                                left = old_body.scrollLeft();
                            new_frame.contents().find('body').scrollTop(top).scrollLeft(left);
                        }
                    } catch (e) {
                        // If the user navigated away from the service application, a cross origin
                        // frame access exception will be raised.
                    }
                    old_frame.remove();
                    new_frame.attr('id', 'render');
                }).attr('src', state.file.url);
            } else {
                jQuery('#render').attr('src', '');
            }
        }
    }

    external() {
        var state = this.pelicide.editor.state;
        if (state && state.file.url)
            window.open(state.file.url);
    }

    setUpScrollSync(scrollSource) {
        var pending = false;

        jQuery(scrollSource).on('scroll', (event) => {
            var el = jQuery(event.target);
            if (!pending) {
                pending = true;
                setTimeout(() => {
                    var target = jQuery('#preview_container'),
                        f = el.scrollTop() / (el.prop('scrollHeight') - el.prop('offsetHeight'));
                    target.scrollTop(f * (target.prop('scrollHeight') - target.prop('offsetHeight')));
                    pending = false;
                }, 25);
            }
        });
    }
}

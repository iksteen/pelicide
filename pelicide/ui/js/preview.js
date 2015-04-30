define([
    'js/util',
    'js/api',
    'jquery',
    'vitmalina/w2ui'
], function(Util, API, jQuery) {
    API = API.default;

    function Preview(pelicide, options) {
        options = jQuery.extend({previewDelay: 50}, options);

        this.pelicide = pelicide;
        this.delay = options.previewDelay;
        this._mode = null;
        this._pending = false;
    }

    Preview.prototype = {
        layout: function() {
            var self = this;

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
                            onClick: function () { self.mode('draft'); }
                        },
                        {
                            type: 'radio',
                            id: 'render',
                            group: '1',
                            caption: 'Render',
                            onClick: function () { self.mode('render'); }
                        },
                        {type: 'break'},
                        {
                            type: 'button',
                            id: 'update_preview',
                            icon: 'fa fa-refresh',
                            hint: 'Refresh',
                            disabled: true,
                            onClick: function () { self.update(); }
                        },
                        {
                            type: 'button',
                            id: 'external_preview',
                            icon: 'fa fa-external-link',
                            hint: 'Open in new window',
                            disabled: true,
                            onClick: function () { self.external(); }
                        }
                    ]
                }
            };
        },

        render: function (box, toolbar) {
            this._box = box;
            this._toolbar = toolbar;

            var self = this;

            this.pelicide.editor.on({ type: 'change', execute: 'after' }, function () {
                self.schedule();
            });
            this.pelicide.editor.on({ type: 'open', execute: 'after' }, function () {
                toolbar.enable('update_preview');
                toolbar.enable('external_preview');
                self.update();
            });
            this.pelicide.editor.on({ type: 'close', execute: 'after' }, function () {
                toolbar.disable('update_preview');
                toolbar.disable('external_preview');
                self.update();
            });
            this.pelicide.project.on({ type: 'rebuild', execute: 'after' }, function () {
                if (self.mode() == 'render')
                    self.update();
            });
            this.pelicide.editor.on({ type: 'rebuild', execute: 'after' }, function () {
                if (self.mode() == 'render')
                    self.update();
            });

            this.mode('draft');
        },

        mode: function (mode) {
            if(arguments.length === 0) {
                return this._mode;
            }

            var self = this;

            setTimeout(function() {
                self._toolbar.check((mode == 'render') ? 'render' : 'draft');
                self._toolbar.uncheck((mode == 'render') ? 'draft' : 'render');
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
        },

        schedule: function () {
            var self = this;

            if (this.mode() == 'draft' && !this._pending) {
                this._pending = true;
                setTimeout(function () {
                    self._pending = false;
                    self.update();
                }, this.delay);
            }
        },

        update: function () {
            var state = this.pelicide.editor.state();

            if(this.mode() != 'render') {
                var preview = jQuery('#preview');

                if (state) {
                    API.render(state.mode, state.content).then(function (html) {
                        preview.html(html);
                    }, function (e) {
                        preview.empty().append(
                            '<h3 style="color: red">Render failed:</h3>',
                            jQuery('<p>').html(error.error.message)
                        );
                    });
                } else {
                    preview.empty();
                }
            } else {
                if(state && state.file.url) {
                    var old_frame=$('#render'),
                        new_frame = $('<iframe>').appendTo(old_frame.parent());

                    new_frame.one('load', function () {
                        try {
                            // Try to preserve the old scroll position.
                            var old_doc = old_frame.contents();
                            if (old_doc.prop('location') == state.file.url) {
                                var old_body = old_doc.find('body'),
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
                    $('#render').attr('src', '');
                }
            }
        },

        external: function () {
            var state = this.pelicide.editor.state();
            if (state && state.file.url)
                window.open(state.file.url);
        },

        setUpScrollSync: function (el) {
            var pending = false;

            el = jQuery(el);
            el.on('scroll', function (e) {
                if (!pending) {
                    pending = true;
                    setTimeout(function () {
                        var target = jQuery('#preview_container'),
                            f = el.scrollTop() / (el.prop('scrollHeight') - el.prop('offsetHeight'));
                        target.scrollTop(f * (target.prop('scrollHeight') - target.prop('offsetHeight')));
                        pending = false;
                    }, 25);
                }
            });
        }
    };

    return Preview;
});
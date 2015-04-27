define([
    'jquery',
    'js/cm-editor',
    'cm/mode/markdown/markdown'
], function(jQuery, CMEditor) {
    function MDEditor(pelicide, parent_el, content) {
        CMEditor.call(this, pelicide, parent_el, content);
    }

    MDEditor.prototype = Object.create(CMEditor.prototype);
    jQuery.extend(
        MDEditor.prototype,
        {
            constructor: MDEditor,
            mode: 'markdown'
        }
    );

    MDEditor.formats = ['md', 'markdown', 'mdown'];
    MDEditor.templates = {
        article: function (record) {
            return 'Title: ' + record.title + '\n' +
                'Date: ' + record.date + '\n' +
                'Status: ' + record.status + '\n' +
                'Tags:\n' +
                (record.category ? ('Category: ' + record.category + '\n') : '') +
                'Slug: ' + record.slug + '\n\n';
        }
    };


    return MDEditor;
});

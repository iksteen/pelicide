define([
    'jquery',
    'js/cm-editor',
    'cm/mode/rst/rst'
], function(jQuery, CMEditor) {
    function RSTEditor(pelicide, parent_el, content) {
        CMEditor.call(this, pelicide, parent_el, content);
    }

    RSTEditor.prototype = Object.create(CMEditor.prototype);
    jQuery.extend(
        RSTEditor.prototype,
        {
            constructor: RSTEditor,
            mode: 'rst'
        }
    );

    RSTEditor.formats = ['rst'];
    RSTEditor.templates = {
        article: function (record) {
            var titleLen = record.title.length;
            return record.title + '\n' +
                (new Array(titleLen + 1).join('#')) + '\n\n' +
                ':date: ' + record.date + '\n' +
                ':tags: \n' +
                (record.category ? (':category: ' + record.category + '\n') : '') +
                ':slug: ' + record.slug + '\n\n';
        }
    };

    return RSTEditor;
});
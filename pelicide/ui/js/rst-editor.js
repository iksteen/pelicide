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

    return RSTEditor;
});
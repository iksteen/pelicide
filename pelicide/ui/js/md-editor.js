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

    return MDEditor;
});
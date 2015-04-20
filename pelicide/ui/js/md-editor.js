define([
    'jquery',
    'js/cm-editor',
    'cm/mode/markdown/markdown'
], function(jq, CMEditor) {
    function MDEditor(pelicide, parent_el, content) {
        CMEditor.call(this, pelicide, parent_el, content);
    }

    MDEditor.prototype = Object.create(CMEditor.prototype);
    jq.extend(
        MDEditor.prototype,
        {
            constructor: MDEditor,
            mode: 'markdown'
        }
    );

    MDEditor.formats = ['md', 'markdown', 'mdown'];

    return MDEditor;
});

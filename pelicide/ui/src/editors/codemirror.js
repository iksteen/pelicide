import CodeMirror from 'codemirror/lib/codemirror';
import 'codemirror/addon/search/search';
import 'codemirror/lib/codemirror.css!';
import 'codemirror/addon/dialog/dialog.css!';
import 'src/css/codemirror-theme.css!';


export default class CMEditor {
    constructor(editor, parent_el, content, mode='text/plain') {
        this.editor = editor;
        this._actionId = 0;
        this._keymap = {};
        this._codeMirror = CodeMirror(
            parent_el,
            {
                value: content,
                lineWrapping: true,
                mode: mode,
                theme: 'pelicide'
            }
        );

        if (CodeMirror.autoLoadMode !== undefined) {
            CodeMirror.autoLoadMode(this._codeMirror, mode);
        }

        // Notify editor component of change.
        this._codeMirror.on('change', () => editor.change());

        // Make sure CodeMirror refreshes when the panel size changes.
        this._onLayoutChanged = () => this._codeMirror.refresh();
        editor.pelicide.on({type: 'layout'}, this._onLayoutChanged);

        // Sync preview scrolling
        editor.pelicide.preview.setUpScrollSync(this._codeMirror.getScrollerElement());

        // Set focus to editor widget.
        this._codeMirror.focus();
    }

    addActions(actions) {
        var items = [],
            meta = this.editor.pelicide.metaKey;

        for(let section of actions) {
            items.push({
                'id': 'cm_' + (++this._actionId),
                'type': 'break'
            });

            for(let action of section) {
                if (!action.action)
                    continue;

                let hint = action.hint;

                if (action.key) {
                    let key = action.key.replace('{meta}', meta);
                    if (hint)
                        hint += ` (${key})`;
                    this._keymap[key] = action.action;
                }

                if (action.text || action.icon) {
                    items.push(Object.assign(
                        {
                            id: 'cm_' + (++this._actionId),
                            onClick: action.action
                        },
                        action,
                        {
                            hint: hint
                        }
                    ));
                }
            }
        }

        this.editor.addEditorToolbarItems(items);
        this._codeMirror.setOption('extraKeys', this._keymap);
    }

    close() {
        this.editor.pelicide.off({type: 'layout'}, this._onLayoutChanged);
        this._codeMirror = null;
    }

    content() {
        return this._codeMirror.getValue();
    }

    static get formats() { return ['text']; }
    static get icon() { return ['fa fa-file-text-o']; }
    static get extensions() { return []; }
    static get templates() { return {}; }

    insert(text, offset = 0) {
        var doc = this._codeMirror.getDoc(),
            cursor = Object.assign({}, doc.getCursor(), {ch: 0});

        doc.replaceSelection(text);
        doc.setCursor({line: cursor.line, ch: cursor.ch + text.length - offset});

        this._codeMirror.focus();
    }

    surround(start_decorator, stop_decorator = null, offset = null) {
        if (stop_decorator === null) {
            stop_decorator = start_decorator;
        }

        if(offset === null) {
            offset = stop_decorator.length;
        }

        var doc = this._codeMirror.getDoc();
        doc.replaceSelection(start_decorator + doc.getSelection() + stop_decorator);

        var cursor = doc.getCursor();
        cursor.ch -= offset;
        doc.setCursor(cursor);

        this._codeMirror.focus();
    }

    replaceLinePrefix(search, replace, skipEmpty=true) {
        var doc = this._codeMirror.getDoc();

        function replacePrefix(lineNo) {
            var line = doc.getLine(lineNo),
                match = search.exec(line),
                startPos = {line: lineNo, ch: 0},
                endPos = {line: lineNo, ch: (match === null ? 0 : match[0].length)};

            if (skipEmpty && !line)
                return;

            doc.replaceRange(replace(match), startPos, endPos);
        }

        var from = doc.getCursor('from').line,
            to = doc.getCursor('to').line;

        for (let i = from; i <= to; ++i)
            replacePrefix(i);

        this._codeMirror.focus();
    }
}

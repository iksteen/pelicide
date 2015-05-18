import CMEditor from 'src/editors/codemirror';
import 'codemirror/mode/rst/rst';


function template(record) {
    return `${record.title}
${'#'.repeat(record.title.length)}

:date: ${record.date}
:status: ${record.status.id}
:tags: `+ (record.category ? `
:category: ${record.category}` : '') + `
:slug: ${record.slug}

`;
}


export default class RSTEditor extends CMEditor {
    constructor(editor, parent_el, content) {
        super(editor, parent_el, content, 'rst');

        this.addActions([
            [
                {
                    icon: 'fa fa-bold',
                    hint: 'Bold',
                    key: '{meta}-B',
                    action: () => this.surround('**')
                },
                {
                    icon: 'fa fa-italic',
                    hint: 'Italic',
                    key: '{meta}-I',
                    action: () => this.surround('*')
                }
            ],
            [
                {
                    icon: 'fa fa-link',
                    hint: 'Insert link',
                    ley: '{meta}-L',
                    action: () => this.link()
                },
                {
                    icon: 'fa fa-list-ul',
                    hint: 'Unordered list item (${ctrl}U)',
                    key: '{meta}-U',
                    action: () => this.ul()
                }
            ]
        ]);
    }

    static get formats() {
        return ['text/x-rst'];
    }

    static get extensions() {
        return ['rst'];
    }

    static get templates() {
        return {
            article: template,
            page: template
        }
    }

    link() {
        var doc = this._codeMirror.getDoc();
        if (doc.somethingSelected()) {
            let text = doc.getSelection();
            if (/^\w+:\/\/|^mailto:/.test(text)) {
                this.surround('` <', '>`_', text.length + 5);
            } else {
                this.surround('`', ' <http://>`_', 3);
            }
        } else {
            this.insert('` <http://>`_', 12);
        }
    }

    ul() {
        this.replaceLinePrefix(/^\s*[*+-]\s/, match => match ? '': '* ');
    }
}

import CMEditor from 'js/cm-editor';
import 'codemirror/mode/markdown/markdown';

export default class MDEditor extends CMEditor {
    constructor(pelicide, parent_el, content) {
        super(pelicide, parent_el, content);
    }

    get mode() { return 'markdown'; }

    static get formats() {
        return ['md', 'markdown', 'mdown'];
    }

    static get templates() {
        return {
            article: function (record) {
                return 'Title: ' + record.title + '\n' +
                    'Date: ' + record.date + '\n' +
                    'Status: ' + record.status.id + '\n' +
                    'Tags:\n' +
                    (record.category ? ('Category: ' + record.category + '\n') : '') +
                    'Slug: ' + record.slug + '\n\n';
            }
        }
    }
}

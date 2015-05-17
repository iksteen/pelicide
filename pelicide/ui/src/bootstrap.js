import API from 'src/api';
import Pelicide from 'src/pelicide';
import {alert} from 'src/util';
import ArticleContent from 'src/content/article';
import PageContent from 'src/content/page';
import CMEditor from 'src/editors/codemirror';
import MDEditor from 'src/editors/markdown';
import RSTEditor from 'src/editors/restructuredtext';
import Jinja2Editor from 'src/editors/jinja2';
import CSSEditor from 'src/editors/css';
import JSEditor from 'src/editors/javascript';

export function bootstrap(demo=false) {
    // Set up API endpoint.
    API.configure('rpc');

    Promise.all([
        API.get('SITENAME'),
        API.list_extensions(),
        API.can_deploy()
    ]).then(function ([sitename, extensions, canDeploy]) {
        document.title = sitename + ' (Pelicide)';

        // Set up and start Pelicide UI.
        var pelicide = new Pelicide({
            sitename: sitename || '',
            extensions: extensions,
            contentTypes: [
                ArticleContent,
                PageContent
            ],
            canDeploy: canDeploy,
            editors: [
                MDEditor,
                RSTEditor,
                CMEditor,
                Jinja2Editor,
                CSSEditor,
                JSEditor
            ]
        });
        pelicide.run('#main_layout');

        if(demo)
            setTimeout(function () { pelicide.editor.open(pelicide.project.getFile(['content'], 'welcome-to-pelicide.md')); }, 0);
    }).catch(alert);
}

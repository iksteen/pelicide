import jQuery from 'jquery';
import API from 'src/api';
import Pelicide from 'src/pelicide';
import {alert} from 'src/util';
import ArticleContent from 'src/content/article';
import PageContent from 'src/content/page';
import CMEditor from 'src/editors/codemirror';
import MDEditor from 'src/editors/markdown';
import RSTEditor from 'src/editors/restructuredtext';
import Jinja2Editor from 'src/editors/jinja2';

export function bootstrap(demo=false) {
    // Set up API endpoint.
    API.configure('rpc');

    // Start Pelicide UI when DOM is ready.
    jQuery(function () {
        API.get('SITENAME').then(function (sitename) {
            document.title = sitename + ' (Pelicide)';

            // Set up and start Pelicide UI.
            var pelicide = new Pelicide({
                sitename: sitename || '',
                contentTypes: [
                    ArticleContent,
                    PageContent
                ],
                editors: [
                    MDEditor,
                    RSTEditor,
                    CMEditor,
                    Jinja2Editor
                ]
            });
            pelicide.run('#main_layout');

            if(demo)
                setTimeout(function () { pelicide.editor.open(pelicide.project.getFile(['content'], 'welcome-to-pelicide.md')); }, 0);
        }).catch(alert);
    });
}

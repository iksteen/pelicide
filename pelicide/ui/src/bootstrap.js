import jQuery from 'jquery';
import API from 'src/api';
import Pelicide from 'src/pelicide';
import {alert} from 'src/util';
import ArticleContent from 'src/article-content';
import MDEditor from 'src/md-editor';
import RSTEditor from 'src/rst-editor';

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
                    ArticleContent
                ],
                editors: [
                    MDEditor,
                    RSTEditor
                ]
            });
            pelicide.run('#main_layout');

            if(demo)
                setTimeout(function () { pelicide.editor.open([], 'welcome-to-pelicide.md'); }, 0);
        }).catch(alert);
    });
}

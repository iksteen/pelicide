import os
from twisted.web.static import File

here = os.path.dirname(__file__)

if os.path.exists(os.path.join(here, 'build.js')):
    resource = File(os.path.join(here, 'index-prod.html'))
else:
    resource = File(os.path.join(here, 'index-dev.html'))

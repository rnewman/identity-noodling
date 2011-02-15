#
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Identity prototype.
#
# The Initial Developer of the Original Code is Mozilla Foundation.
# Portions created by the Initial Developer are Copyright (C) 2008
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Dan Mills <thunder@mozilla.com> (original author)
#   Justin Dolske <dolske@mozilla.com>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

ifeq ($(TOPSRCDIR),)
  export TOPSRCDIR = $(shell pwd)
endif

objdir=$(TOPSRCDIR)/dist
export stage_dir=$(objdir)/stage
xpi_dir=$(objdir)/xpi

xpi_name := identity.xpi
xpi_files := chrome/identity.jar defaults components modules \
             platform install.rdf chrome.manifest

SUBST = perl -pe 's/@([^@]+)@/defined $$ENV{$$1} ? $$ENV{$$1} : $$&/ge'
MKDIR = mkdir -p
SLINK = ln -sf
ifneq ($(findstring MINGW,$(shell uname -s)),)
  SLINK = cp
endif

ifneq ($(MOZ_OBJDIR),)
 include $(MOZ_OBJDIR)/config/autoconf.mk
endif

all: xpi

idl:
	$(MOZ_OBJDIR)/dist/bin/xpidl -a -m typelib -w -v -I \
		$(MOZ_OBJDIR)/dist/idl \
		-e $(TOPSRCDIR)/addon/components/IdentityManager.xpt \
		$(TOPSRCDIR)/addon/IdentityManager.idl

setup:
	$(MKDIR) $(objdir)
	$(MKDIR) $(stage_dir)
	$(MKDIR) $(xpi_dir)

build: setup idl
	$(MKDIR) $(stage_dir)
	$(MKDIR) $(stage_dir)/chrome/content
	$(MKDIR) $(stage_dir)/chrome/skin
	$(MKDIR) $(stage_dir)/components
	$(MKDIR) $(stage_dir)/defaults/preferences
	$(SLINK) $(TOPSRCDIR)/addon/chrome.manifest $(stage_dir)/chrome.manifest
	$(SLINK) $(TOPSRCDIR)/addon/install.rdf $(stage_dir)/install.rdf
	$(SLINK) $(TOPSRCDIR)/addon/bootstrap.js $(stage_dir)/bootstrap.js
	$(SLINK) $(TOPSRCDIR)/addon/options.xul $(stage_dir)/chrome/content/options.xul
	$(SLINK) $(TOPSRCDIR)/addon/identity-32x32.png $(stage_dir)/chrome/skin/identity-32x32.png
	$(SLINK) $(TOPSRCDIR)/addon/components/identity.js $(stage_dir)/components/identity.js
	$(SLINK) $(TOPSRCDIR)/addon/components/IdentityManager.xpt $(stage_dir)/components/IdentityManager.xpt
	$(SLINK) $(TOPSRCDIR)/addon/defaults/preferences/identityPrefs.js $(stage_dir)/defaults/preferences/identityPrefs.js

xpi: build
	cd $(stage_dir)/chrome;rm -f identity.jar;zip -0r identity.jar *
	rm -f $(xpi_dir)/$(xpi_name)
	cd $(stage_dir);zip -9r $(xpi_name) $(xpi_files)
	mv $(stage_dir)/$(xpi_name) $(xpi_dir)/$(xpi_name)

clean:
	rm -rf $(objdir)
	rm $(TOPSRCDIR)/addon/components/IdentityManager.xpt

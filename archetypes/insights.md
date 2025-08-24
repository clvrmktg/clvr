+++
date = {{ .Date }}
draft = true
title = '{{ replace .File.ContentBaseName "-" " " | title }}'
description = ""

categories = []
tags = []

[share]
path = ""
alt= ""

[feature]
path = ""
alt= ""
# This is optional
figcaption = ""

#Footnotes will be added based on this front matter. Shortcode for footnote reference in text: {{< footnote id="1" >}}.

# [[footnotes]]
#   id = 1
#   content = ""

+++

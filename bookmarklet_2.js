(function () {
    var version = "2.0.0";
    console.log("Version: " + version);

    var hostOrigin = "https://avoinicu.github.io/jira-printable-cards/";

    try {
        // load jQuery
        if (window.jQuery === undefined) {
            appendScript('//ajax.googleapis.com/ajax/libs/jquery/1.7.0/jquery.min.js');
        }

        // wait untill all scripts loaded
        appendScript('https://qoomon.github.io/void', function(){
            init();
            main();
        });
    } catch (err) {
        console.log(err.message);
    }

    function init(){
        addJQueryFunctions();
        addConsoleFunctions();
        addStringFunctions();
        addDateFunctions();

        printScopeDeviderToken = "<b>Attachment</b>";

        console.logLevel = console.INFO;

        resourceOrigin = hostOrigin+ "resources/";

        APP_JIRA='APP_JIRA'
        APP_PIVOTAL_TRACKER='APP_PIVOTAL_TRACKER'
        issueTracker = 'UNKNOWN'
        if( jQuery("meta[name='application-name'][ content='JIRA']").length > 0){
            issueTracker = APP_JIRA
        } else if( /.*\pivotaltracker.com\/.*/g.test(document.URL)){
            issueTracker = APP_PIVOTAL_TRACKER
        }
    }

    function main(){
        //preconditions
        if(jQuery("#card-print-overlay").length > 0){
            alert("Print Card already opened!");
            return;
        }

        var issueKeyList = getSelectedIssueKeyList();

        if(issueKeyList.length <= 0){
            alert("Please select at least one issue.");
            return;
        }

        jQuery("body").append(printOverlayHTML);
        jQuery("#card-print-overlay").prepend(printOverlayStyle);

        jQuery("#card-print-dialog-title").text("Card Print   -   Loading " + issueKeyList.length + " issues...");
        renderCards(issueKeyList, function(){
            jQuery("#card-print-dialog-title").text("Card Print");
        });
    }

    function print(){
        var printFrame = jQuery("#card-print-dialog-content-iframe");
        var printWindow = printFrame[0].contentWindow;
        var printDocument = printWindow.document;

        printWindow.matchMedia("print").addListener(function() {
            jQuery(".page",printDocument).each(function(position, page) {

                var height = jQuery(page).height()
                    - jQuery(page).find(".card-header").outerHeight()
                    - jQuery(page).find(".card-footer").outerHeight()
                    - jQuery(page).find(".content-header").outerHeight()
                    - 40;
                jQuery(page).find(".description").css("max-height", height+"px");
                var lineHeight = jQuery(page).find(".description").css("line-height");
                lineHeight = lineHeight.substring(0, lineHeight.length - 2);
                var lineClamp = Math.floor(height / lineHeight);
                jQuery(page).find(".description").css("-webkit-line-clamp", lineClamp+"");
            });
        });
        printWindow.print();
    }

    function hideDescription(hide){
        var printFrame = jQuery("#card-print-dialog-content-iframe");
        var printWindow = printFrame[0].contentWindow;
        var printDocument = printWindow.document;
        if(hide){
            jQuery(".description", printDocument).hide();
        } else {
            jQuery(".description", printDocument).show();
        }

        resizeIframe(printFrame);
    }

    function endableMultiCardPage(enable){
        var printFrame = jQuery("#card-print-dialog-content-iframe");
        var printWindow = printFrame[0].contentWindow;
        var printDocument = printWindow.document;
        if(enable){
            jQuery(".page", printDocument).addClass("multiCardPage");
        } else {
            jQuery(".page", printDocument).removeClass("multiCardPage");
        }
    }

    function renderCards(issueKeyList, callback) {

        var printFrame = jQuery("#card-print-dialog-content-iframe");
        var printWindow = printFrame[0].contentWindow;
        var printDocument = printWindow.document;

        printDocument.open();
        printDocument.write("<head/><body/>");

        jQuery("head", printDocument).append(printPanelPageCSS());
        jQuery("head", printDocument).append(printPanelCardCSS());

        console.logInfo("load " + issueKeyList.length + " issues...");

        var deferredList = [];
        jQuery.each(issueKeyList,function(index, issueKey) {
            var page = newPage(issueKey);
            page.attr("index",index);
            page.hide();
            page.find('.key').text(issueKey);
            jQuery("body", printDocument).append(page);
            var deferred = addDeferred(deferredList);
            getCardData(issueKey, function(cardData) {
                console.logDebug("cardData: " + cardData);
                fillCard(page, cardData);
                page.show();
                resizeIframe(printFrame);
                deferred.resolve();
            });
        });
        console.logInfo("wait for issues loaded...");

        applyDeferred(deferredList,function() {
            console.logInfo("...all issues loaded.");
            jQuery(printWindow).load(function(){
                console.logInfo("...all resources loaded.");
                callback();
            })
            printDocument.close();
            console.logInfo("wait for resources loaded...");
        });
    }

    function closePrintPreview(){
        jQuery("#card-print-overlay").remove();
        jQuery("#card-print-overlay-style").remove();
    }

    function getSelectedIssueKeyList() {
        switch(issueTracker) {
            case APP_JIRA:
                return getSelectedIssueKeyListJira();
            case APP_PIVOTAL_TRACKER:
                return getSelectedIssueKeyListPivotalTracker();
        }
    }

    function getSelectedIssueKeyListJira() {

        //Browse
        if (/.*\/browse\/.*/g.test(document.URL)) {
            return jQuery("a[data-issue-key][id='key-val']").map(function() {
                return jQuery(this).attr('data-issue-key');
            });
        }

        // RapidBoard
        if (/.*\/secure\/RapidBoard.jspa.*/g.test(document.URL)) {
            return jQuery('div[data-issue-key].ghx-selected').map(function() {
                return jQuery(this).attr('data-issue-key');
            });
        }

        return [];
    }

    function getSelectedIssueKeyListPivotalTracker() {
        //Single Story
        if (/.*\/stories\/.*/g.test(document.URL)) {
            return [document.URL.replace(/.*\/stories\/(.*)\??/,'$1')];
        }

        // Board
        if (/.*\/projects\/.*/g.test(document.URL)) {
            return jQuery('.story[data-id]:has(.selected)').map(function() {
                return jQuery(this).attr('data-id');
            });
        }

        return [];
    }

    function getCardData(issueKey, callback){
        switch(issueTracker) {
            case APP_JIRA:
                return getCardDataJira(issueKey, callback);
            case APP_PIVOTAL_TRACKER:
                return getCardDataPivotalTracker(issueKey, callback);
        }

    }

    function getCardDataJira(issueKey, callback) {
        getIssueDataJira(issueKey,function(data){

            var issueData = {};

            issueData.key = data.key;

            issueData.type = data.fields.issuetype.name.toLowerCase();

            issueData.summary = data.fields.summary;

            issueData.description = data.renderedFields.description;

            if ( data.fields.assignee ) {
                issueData.assignee = data.fields.assignee.displayName;
                var avatarUrl = data.fields.assignee.avatarUrls['48x48'];
                if(avatarUrl.indexOf("ownerId=") >= 0){
                    issueData.avatarUrl = avatarUrl;
                }
            }

            if ( data.fields.duedate ) {
                issueData.dueDate = new Date(data.fields.duedate).format('D d.m.');
            }

            issueData.hasAttachment = data.fields.attachment.length > 0;
            if(issueData.description){
                var printScope = issueData.description.indexOf(printScopeDeviderToken);
                if (printScope >= 0) {
                    issueData.description = issueData.description.substring(0, printScope);
                    issueData.hasAttachment = true;
                }
            }

            issueData.storyPoints = data.fields.storyPoints;

            issueData.epicKey = data.fields.epicLink;
            if ( issueData.epicKey ) {
                getIssueDataJira(issueData.epicKey , function(data) {
                    issueData.epicName = data.fields.epicName;
                }, false);
            }

            issueData.url = window.location.origin + "/browse/" + issueData.key;

            //check for lrs
            if(true){
                console.logInfo("Apply LRS Specifics");
                //Desired-Date
                if ( data.fields.desiredDate ) {
                    issueData.dueDate = new Date(data.fields.desiredDate).format('D d.m.');
                }
            }

            callback(issueData);
        });
    }

    function getCardDataPivotalTracker(issueKey, callback) {
        getIssueDataPivotalTracker(issueKey,function(data){

            var issueData = {};

            issueData.key = data.id;

            issueData.type = data.kind.toLowerCase();

            issueData.summary = data.name;

            issueData.description = data.description;
            if(issueData.description){
                issueData.description = "<p>"+issueData.description
            }

            if ( data.owned_by && data.owned_by.length > 0 ) {
                issueData.assignee = data.owner_ids[0].name;
            }

            if ( data.deadline ) {
                issueData.dueDate = new Date(data.deadline).format('D d.m.');
            }

            issueData.hasAttachment = false;
            if(issueData.description){
                var printScope = issueData.description.indexOf(printScopeDeviderToken);
                if (printScope >= 0) {
                    issueData.description = issueData.description.substring(0, printScope);
                    issueData.hasAttachment = true;
                }
            }

            issueData.storyPoints = data.estimate;

            issueData.url = data.url;

            callback(issueData);
        });
    }

    function getIssueDataJira(issueKey, callback, async) {
        async = typeof async !== 'undefined' ? async : true;
        //https://docs.atlassian.com/jira/REST/latest/
        var url = '/rest/api/2/issue/' + issueKey + '?expand=renderedFields,names';
        console.logDebug("IssueUrl: " + url);
        console.logDebug("Issue: " + issueKey + " Loading...");
        jQuery.ajax({
            type: 'GET',
            url: url,
            data: {},
            dataType: 'json',
            async: async,
            success: function(responseData){
                console.logDebug("Issue: " + issueKey + " Loaded!");
                // add custom fields with field names
                jQuery.each(responseData.names, function(key, value) {
                    if(key.startsWith("customfield_")){
                        var newFieldId = value.toCamelCase();
                        console.logTrace("add new field: " + newFieldId +" with value from "+ key);
                        responseData.fields[value.toCamelCase()] = responseData.fields[key];
                    }
                });
                callback(responseData);
            },
        });
    }

    function getIssueDataPivotalTracker(issueKey, callback, async) {
        async = typeof async !== 'undefined' ? async : true;
        //http://www.pivotaltracker.com/help/api
        var url = 'https://www.pivotaltracker.com/services/v5/stories/' + issueKey + "?fields=name,kind,description,story_type,owned_by(name),comments(file_attachments(kind)),estimate,deadline";
        console.logDebug("IssueUrl: " + url);
        console.logDebug("Issue: " + issueKey + " Loading...");
        jQuery.ajax({
            type: 'GET',
            url: url,
            data: {},
            dataType: 'json',
            async: async,
            success: function(responseData){
                console.logDebug("Issue: " + issueKey + " Loaded!");
                callback(responseData);
            },
        });
    }

    function fillCard(card, data) {
        //Key
        card.find('.key').text(data.key);

        //Type
        card.find(".card").attr("type", data.type);

        //Summary
        card.find('.summary').text(data.summary);

        //Description
        card.find('.description').html(data.description);

        //Assignee
        if ( data.assignee ) {
            if(data.avatarUrl){
                card.find(".assignee").css("background-image", "url('" + data.avatarUrl + "')");
            } else {
                card.find(".assignee").text(data.assignee[0].toUpperCase());
            }
        } else {
            card.find(".assignee").addClass("hidden");
        }

        //Due-Date
        if ( data.dueDate ) {
            card.find(".due-date").text(data.dueDate);
        } else {
            card.find(".due").addClass("hidden");
        }

        //Attachment
        if ( data.hasAttachment ) {
        } else{
            card.find('.attachment').addClass('hidden');
        }

        //Story Points
        if (data.storyPoints) {
            card.find(".estimate").text(data.storyPoints);
        } else {
            card.find(".estimate").addClass("hidden");
        }

        //Epic
        if ( data.epicKey ) {
            card.find(".epic-key").text(data.epicKey);
            card.find(".epic-name").text(data.epicName);
        } else {
            card.find(".epic").addClass("hidden");
        }

        //QR-Code
        var qrCodeUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=256x256&chld=L|1&chl=' + encodeURIComponent(data.url);
        card.find(".qr-code").css("background-image", "url('" + qrCodeUrl + "')");
    }


    function printOverlayHTML(){


        var result = jQuery(document.createElement('div'))
            .attr("id","card-print-overlay")
            .html(multilineString(function() {
                /*!
                 <div id="card-print-dialog">
                 <div id="card-print-dialog-header">
                 <div id="card-print-dialog-title">Card Print</div>
                 </div>
                 <div id="card-print-dialog-content">
                 <iframe id="card-print-dialog-content-iframe"></iframe>
                 </div>
                 <div id="card-print-dialog-footer">
                 <div class="buttons">
                 <label style="margin-right:10px"><input id="multi-card-page-checkbox" type="checkbox"/>Multi Card Page</label>
                 <input id="card-print-dialog-print" type="button" class="aui-button aui-button-primary" value="Print" />
                 <a id="card-print-dialog-cancel" title="Cancel" class="cancel">Cancel</a>
                 </div>
                 </div>
                 </div>
                 */
            }));

        // info
        result.find("#report-issue")
            .click(function(event){
                window.open('https://github.com/qoomon/Jira-Issue-Card-Printer/issues');
                return false;
            });

        result.find("#about")
            .click(function(event){
                window.open('http://qoomon.blogspot.de/2014/01/jira-issue-card-printer-bookmarklet.html');
                return false;
            });

        // enable multe card page

        result.find("#multi-card-page-checkbox")
            .click(function() {
                endableMultiCardPage(this.checked);
                return true;
            });

        // hide description

        result.find("#hide-description-checkbox")
            .click(function() {
                hideDescription(this.checked);
                return true;
            });

        // scale card

        result.find("#card-scale-range").on("input", function() {
            var printFrame = jQuery("#card-print-dialog-content-iframe");
            var printWindow = printFrame[0].contentWindow;
            var printDocument = printWindow.document;
            jQuery("html", printDocument).css("font-size", jQuery(this).val() +"cm");
            resizeIframe(printFrame);
        });

        // print

        result.find("#card-print-dialog-print")
            .click(function(event){
                print();
                return false;
            });

        // closePrintPreview

        result.find("#card-print-dialog-cancel")
            .click(function(event){
                closePrintPreview();
                return false;
            });

        result.click(function(event) {
            if( event.target == this ){
                closePrintPreview();
            }
            return true;
        });

        jQuery(document).keyup(function(e) {
            if (e.keyCode == 27) {  // esc
                closePrintPreview();
            }
        });

        // prevent background scrolling
        result.scroll(function(event) {
            return false;
        });

        return result;
    }

    function printOverlayStyle(){
        var result = jQuery(document.createElement('style'))
            .attr("id", "card-print-overlay-style")
            .attr("type", "text/css")
            .html(multilineString(function() {
                /*!
                 #card-print-overlay {
                 position: fixed;
                 height: 100%;
                 width: 100%;
                 top: 0;
                 left: 0;
                 background:rgba(0, 0, 0, 0.5);

                 box-sizing: border-box;
                 word-wrap:break-word;
                 z-index: 99999;

                 }

                 #card-print-dialog {
                 position: relative;

                 top: 60px;
                 right:0px;
                 left:0px;

                 height: calc(100% - 120px);
                 width: 1000px;
                 margin: auto;

                 border-style: solid;
                 border-color: #cccccc;
                 border-width: 1px;
                 -moz-border-radius: 4px;
                 -webkit-border-radius: 4px;
                 border-radius: 4px;

                 overflow: hidden;
                 }

                 #card-print-dialog-header {
                 position: relative;
                 background: #f0f0f0;
                 height: 25px;

                 border-bottom: 1px solid #cccccc;

                 padding: 15px 20px 15px 20px;
                 }

                 #card-print-dialog-content {
                 position: relative;
                 background: white;
                 height: calc(100% - 106px);
                 width: 100%;

                 overflow-y: scroll;
                 }

                 #card-print-dialog-content-iframe {
                 position: relative;
                 height: 100%;
                 width: 100%;

                 border:none;
                 }

                 #card-print-dialog-footer {
                 position: relative;
                 background: #f0f0f0;
                 border-top: 1px solid #cccccc;
                 height: 30px;
                 padding: 10px;
                 text-align: right;
                 }

                 #buttons {
                 position: relative;
                 float: right;
                 display: inline-block;
                 height 30px;
                 }

                 #info {
                 position: relative;
                 float: right;
                 display: inline-block;
                 height 30px;
                 }

                 #card-print-dialog-title{
                 position: relative;
                 float: left;
                 color: rgb(51, 51, 51);
                 display: block;
                 font-family: Arial, sans-serif;
                 font-size: 20px;
                 font-weight: normal;
                 height: 30px;
                 line-height: 30px;
                 }
                 .cancel{
                 cursor: pointer;
                 font-size: 14px;
                 display: inline-block;
                 padding: 5px 10px;
                 vertical-align: baseline;
                 }
                 */
            }));
        return result;
    }


    function printPanelPageCSS(){

        var result = jQuery(document.createElement('style'))
            .attr("id", "printPanelPageStyle")
            .attr("type", "text/css")
            .html(multilineString(function() {
                /*!
                 HTML {
                 font-size: 1.0cm;
                 }
                 .page {
                 position: relative;
                 overflow: auto;
                 margin-left: auto;
                 margin-right: auto;
                 padding: 1.0cm;
                 margin: 1.0cm;
                 width: auto;
                 height: auto;
                 page-break-after: always;
                 page-break-inside: avoid;

                 background:white;

                 -webkit-box-shadow: 0px 0px 7px 3px rgba(31,31,31,0.4);
                 -moz-box-shadow: 0px 0px 7px 3px rgba(31,31,31,0.4);
                 box-shadow: 0px 0px 7px 3px rgba(31,31,31,0.4);

                 border-style: solid;
                 border-color: #bfbfbf;
                 border-width: 0.05cm;
                 -moz-border-radius: 0.1cm;
                 -webkit-border-radius: 0.1cm;
                 border-radius: 0.1cm;

                 overflow: hidden;

                 }

                 .multiCardPage {
                 page-break-after: avoid;
                 }



                 @media print {

                 .page {
                 background: white;
                 border-style: none;
                 padding: 0.0cm;
                 margin: 0.0cm;
                 margin-top: 0cm;

                 -webkit-box-shadow: none;
                 -moz-box-shadow: none;
                 box-shadow: none;

                 -webkit-print-color-adjust:exact;
                 print-color-adjust: exact;

                 -webkit-filter:opacity(1.0);
                 filter:opacity(1.0);
                 }

                 .page:first-of-type {
                 margin-top: 0cm;
                 }

                 .page:last-of-type {
                 page-break-after: auto;
                 }

                 }
                 */
            }));

        return result;
    }


    // http://www.cssdesk.com/scHcP

    function newPage(issueKey){
        var page = jQuery(document.createElement('div'))
            .attr("id",issueKey)
            .addClass("page")
            .addClass("singleCardPage")
            .html(multilineString(function() {
                /*!
                 <div class="card">
                 <div class="card-content">
                 <span class="card-title">
                 <span class="key"></span>
                 </span>
                 <p class="summary"></p>
                 </div>
                 <div class="card-action">


                 <div class="badge">
                 <span class="estimate"></span>
                 </div>

                 </div>
                 </div>
                 */
            }));

        return page;
    }

    function printPanelCardCSS(){
        var result = jQuery(document.createElement('style'))
            .attr("type", "text/css")
            .html(multilineString(function() {
                /*!
                 @import url(https://fonts.googleapis.com/css?family=Roboto);
                 @import url(https://maxcdn.bootstrapcdn.com/font-awesome/4.3.0/css/font-awesome.min.css);
                 * {
                 color: black;
                 font-family: Roboto, sans-serif;
                 }
                 body {
                 margin: 0;
                 }
                 .hidden {
                 visibility: hidden;
                 }
                 .card {
                 position: relative;
                 border: 1px solid rgba(160, 160, 160, 0.2);
                 position: relative;
                 overflow: hidden;
                 margin: 0;
                 background-color: #fff;
                 border-radius: 2px;
                 width: 75%;
                 box-sizing: border-box;
                 float: left;
                 }
                 .card-content {
                 padding: 20px;
                 border-radius: 0 0 2px 2px;
                 font-size: 20px;
                 }
                 .card-title {
                 line-height: 48px;
                 font-size: 16px;
                 font-weight: 300;
                 }
                 .key {
                 font-size: 1rem;
                 }
                 .badge {
                 color: #fff;
                 background-color: #000;
                 border-radius: 2px;
                 min-width: 2rem;
                 padding: 0 6px;
                 min-width: 3rem;
                 text-align: center;
                 line-height: inherit;
                 box-sizing: border-box;
                 }
                 .summary {
                 font-size: 1rem;
                 }
                 .card-action {
                 padding: 20px;
                 text-align: right;

                 }
                 .estimate {
                 color: #fff;
                 }
                 .card-action div {
                 display: inline-block;
                 margin-right: 20px;
                 text-transform: uppercase;
                 }
                 */
            }).replace(/{RESOURCE_ORIGIN}/g, resourceOrigin));
        return result;
    }

    //############################################################################################################################
    //############################################################################################################################
    //############################################################################################################################

    function appendScript(url, callback){

        var head = document.getElementsByTagName('head')[0];
        var script = document.createElement('script');
        script.src = url;

        // Then bind the event to the callback function.
        // There are several events for cross browser compatibility.
        script.onreadystatechange = callback;
        script.onload = callback;

        head.appendChild(script);
    }

    //############################################################################################################################
    //############################################################################################################################
    //############################################################################################################################

    function addDeferred(deferredList){
        var deferred = new jQuery.Deferred()
        deferredList.push(deferred);
        return deferred;
    }

    function applyDeferred(deferredList, callback){
        jQuery.when.apply(jQuery, deferredList).done(callback);
    }

    //############################################################################################################################
    //############################################################################################################################
    //############################################################################################################################


    function addJQueryFunctions() {
        //jQuery Extention
        jQuery.expr[':']['is'] = function(node, index, props){
            return node.textContent == props[3];
        }
    }


    function addConsoleFunctions() {

        console.ERROR = 0;
        console.WARN  = 1;
        console.INFO  = 2;
        console.DEBUG = 3;
        console.TRACE = 4;

        console.logLevel = console.INFO ;

        console.logError = function(msg){
            if(console.logLevel >= console.ERROR ) {
                console.log("ERROR: " + msg);
            }
        }

        console.logWarn = function(msg){
            if(console.logLevel >= console.WARN ) {
                console.log("WARN:  " + msg);
            }
        }

        console.logInfo = function(msg){
            if(console.logLevel >= console.INFO ) {
                console.log("INFO:  " + msg);
            }
        }

        console.logDebug = function(msg){
            if(console.logLevel >= console.DEBUG ) {
                console.log("DEBUG: " + msg);
            }
        }

        console.logTrace = function(msg){
            if(console.logLevel >= console.TRACE ) {
                console.log("TRACE: " + msg);
            }
        }
    }

    function addStringFunctions() {

        //trim string - remove leading and trailing whitespaces
        if (!String.prototype.trim) {
            String.prototype.trim = function() {
                return this.replace(/^\s+|\s+$/g, '');
            };
        }

        if (!String.prototype.startsWith) {
            String.prototype.startsWith = function (str){
                return this.slice(0, str.length) == str;
            };
        }

        if (!String.prototype.endsWith) {
            String.prototype.endsWith = function (str){
                return this.slice(-str.length) == str;
            };
        }

        if (!String.prototype.toCamelCase) {
            String.prototype.toCamelCase = function() {
                // remove all characters that should not be in a variable name
                // as well underscores an numbers from the beginning of the string
                var s = this.replace(/([^a-zA-Z0-9_\- ])|^[_0-9]+/g, "").trim().toLowerCase();
                // uppercase letters preceeded by a hyphen or a space
                s = s.replace(/([ -]+)([a-zA-Z0-9])/g, function(a,b,c) {
                    return c.toUpperCase();
                });
                // uppercase letters following numbers
                s = s.replace(/([0-9]+)([a-zA-Z])/g, function(a,b,c) {
                    return b + c.toUpperCase();
                });
                return s;
            }
        }
    }

    function addDateFunctions() {

        Date.prototype.format = function(format) {
            var returnStr = '';
            var replace = Date.replaceChars;
            for (var i = 0; i < format.length; i++) {       var curChar = format.charAt(i);         if (i - 1 >= 0 && format.charAt(i - 1) == "\\") {
                returnStr += curChar;
            }
            else if (replace[curChar]) {
                returnStr += replace[curChar].call(this);
            } else if (curChar != "\\"){
                returnStr += curChar;
            }
            }
            return returnStr;
        };

        Date.replaceChars = {
            shortMonths: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            longMonths: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
            shortDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            longDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],

            // Day
            d: function() { return (this.getDate() < 10 ? '0' : '') + this.getDate(); },
            D: function() { return Date.replaceChars.shortDays[this.getDay()]; },
            j: function() { return this.getDate(); },
            l: function() { return Date.replaceChars.longDays[this.getDay()]; },
            N: function() { return this.getDay() + 1; },
            S: function() { return (this.getDate() % 10 == 1 && this.getDate() != 11 ? 'st' : (this.getDate() % 10 == 2 && this.getDate() != 12 ? 'nd' : (this.getDate() % 10 == 3 && this.getDate() != 13 ? 'rd' : 'th'))); },
            w: function() { return this.getDay(); },
            z: function() { var d = new Date(this.getFullYear(),0,1); return Math.ceil((this - d) / 86400000); }, // Fixed now
            // Week
            W: function() { var d = new Date(this.getFullYear(), 0, 1); return Math.ceil((((this - d) / 86400000) + d.getDay() + 1) / 7); }, // Fixed now
            // Month
            F: function() { return Date.replaceChars.longMonths[this.getMonth()]; },
            m: function() { return (this.getMonth() < 9 ? '0' : '') + (this.getMonth() + 1); },
            M: function() { return Date.replaceChars.shortMonths[this.getMonth()]; },
            n: function() { return this.getMonth() + 1; },
            t: function() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 0).getDate() }, // Fixed now, gets #days of date
            // Year
            L: function() { var year = this.getFullYear(); return (year % 400 == 0 || (year % 100 != 0 && year % 4 == 0)); },   // Fixed now
            o: function() { var d  = new Date(this.valueOf());  d.setDate(d.getDate() - ((this.getDay() + 6) % 7) + 3); return d.getFullYear();}, //Fixed now
            Y: function() { return this.getFullYear(); },
            y: function() { return ('' + this.getFullYear()).substr(2); },
            // Time
            a: function() { return this.getHours() < 12 ? 'am' : 'pm'; },
            A: function() { return this.getHours() < 12 ? 'AM' : 'PM'; },
            B: function() { return Math.floor((((this.getUTCHours() + 1) % 24) + this.getUTreminutes() / 60 + this.getUTCSeconds() / 3600) * 1000 / 24); }, // Fixed now
            g: function() { return this.getHours() % 12 || 12; },
            G: function() { return this.getHours(); },
            h: function() { return ((this.getHours() % 12 || 12) < 10 ? '0' : '') + (this.getHours() % 12 || 12); },
            H: function() { return (this.getHours() < 10 ? '0' : '') + this.getHours(); },
            i: function() { return (this.getMinutes() < 10 ? '0' : '') + this.getMinutes(); },
            s: function() { return (this.getSeconds() < 10 ? '0' : '') + this.getSeconds(); },
            u: function() { var m = this.getMilliseconds(); return (m < 10 ? '00' : (m < 100 ? '0' : '')) + m; },
            // Timezone
            e: function() { return "Not Yet Supported"; },
            I: function() {
                var DST = null;
                for (var i = 0; i < 12; ++i) {
                    var d = new Date(this.getFullYear(), i, 1);
                    var offset = d.getTimezoneOffset();
                    if (DST === null) DST = offset;
                    else if (offset < DST) { DST = offset; break; }
                    else if (offset > DST) break;
                }
                return (this.getTimezoneOffset() == DST) | 0;
            },
            O: function() { return (-this.getTimezoneOffset() < 0 ? '-' : '+') + (Math.abs(this.getTimezoneOffset() / 60) < 10 ? '0' : '') + (Math.abs(this.getTimezoneOffset() / 60)) + '00'; },
            P: function() { return (-this.getTimezoneOffset() < 0 ? '-' : '+') + (Math.abs(this.getTimezoneOffset() / 60) < 10 ? '0' : '') + (Math.abs(this.getTimezoneOffset() / 60)) + ':00'; }, // Fixed now
            T: function() { var m = this.getMonth(); this.setMonth(0); var result = this.toTimeString().replace(/^.+ \(?([^\)]+)\)?$/, '$1'); this.setMonth(m); return result;},
            Z: function() { return -this.getTimezoneOffset() * 60; },
            // Full Date/Time
            c: function() { return this.format("Y-m-d\\TH:i:sP"); }, // Fixed now
            r: function() { return this.toString(); },
            U: function() { return this.getTimep() / 1000; }
        };
    }

    function multilineString(commentFunction) {
        return commentFunction.toString()
            .replace(/^[^\/]+\/\*!?/, '')
            .replace(/\*\/[^\/]+$/, '');
    }


    function resizeIframe(iframe) {
        iframe.height(iframe[0].contentWindow.document.body.scrollHeight);
    }

})();
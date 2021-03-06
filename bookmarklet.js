(function () {
    var hostOrigin = "https://avoinicu.github.io/jira-printable-cards/";
    try {

        // load jQuery
        if (window.jQuery === undefined) {
            appendScript('//ajax.googleapis.com/ajax/libs/jquery/1.7.0/jquery.min.js');
        }

        // wait untill all scripts loaded
        jQuery(document).ready(function(){
            init();
            main();
        });

        function init(){
            addJQueryFunctions();
            addStringFunctions();
            addDateFunctions();

            printScopeDeviderToken = "<b>Attachment</b>";
            resourceOrigin = hostOrigin+ "resources/";
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

            // open print preview
            jQuery("body").append(printOverlayHTML);
            jQuery("#card-print-overlay").prepend(printOverlayStyle);

            jQuery("#card-print-dialog-title").text("Card Print   -   Loading " + issueKeyList.length + " issues...");
            renderCards(issueKeyList, function(){
                jQuery("#card-print-dialog-title").text("Card Print");
                //print();
            });
        }

        function print(){
            var printFrame = jQuery("#card-print-dialog-content-iframe");
            var printWindow = printFrame[0].contentWindow;
            var printDocument = printWindow.document;
            printWindow.print();
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

            var deferredList = [];

            issueKeyList.each(function(position, issueKey) {
                var page = newPage(issueKey);
                page.hide();
                page.find('.key').text(issueKey);
                jQuery("body", printDocument).append(page);
                var deferred = addDeferred(deferredList);
                loadCardDataJSON(issueKey, function(responseData) {
                    fillCardWithJSONData(page, responseData);
                    page.show();
                    resizeIframe(printFrame);
                    deferred.resolve();
                });
            });

            applyDeferred(deferredList,function() {

                jQuery(printWindow).load(function(){
                    callback();
                });
                printDocument.close();
            });
        }

        function closePrintPreview(){
            jQuery("#card-print-overlay").remove();
            jQuery("#card-print-overlay-style").remove();
        }


        function getSelectedIssueKeyList() {

            //JIRA
            if (jQuery("meta[name='application-name'][ content='JIRA']").length > 0) {
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
            }

            return [];
        }

        function fillCardWithJSONData(card, data) {

            //Key
            var key = data.key;
            card.find('.key').text(key);

            //Type
            //var type = data.fields.issuetype.name.toLowerCase();
            //card.find(".key").addClass(type);

            //Summary
            var summary = data.fields.summary;
            card.find('.summary').text(summary);

            //Assignee
            //var assignee = data.fields.assignee;
            //if ( assignee ) {
            //    var displayName = assignee.displayName;
            //    card.find(".assignee").text(displayName);
            //} else {
            //    card.find(".assignee").addClass("hidden");
            //}

            //Due-Date
            //var duedate = data.fields.duedate;
            //if ( duedate ) {
            //    var renderedDuedate = new Date(duedate).format('D d.m.');
            //    card.find(".due-date").text(renderedDuedate);
            //} else {
            //    card.find(".due").addClass("hidden");
            //}

            //Story Points
            var storyPoints = data.fields.storyPoints;
            if (storyPoints) {
                card.find(".estimate").text(storyPoints);
            } else {
                card.find(".estimate").addClass("hidden");
            }

            //Epic
            //var epicKey = data.fields.epicLink;
            //if ( epicKey ) {
            //    card.find(".epic-key").text(epicKey);
            //    loadCardDataJSON(epicKey, function(responseData) {
            //        var epicName = responseData.fields.epicName;
            //        card.find(".epic-name").text(epicName);
            //    }, false);
            //} else {
            //    card.find(".epic").addClass("hidden");
            //}

            //QR-Code
            //var qrCodeImageUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=256x256&chld=L|1&chl=' + window.location.origin + "/browse/" + key;
            //card.find(".qr-code").css("background-image", "url('" + qrCodeImageUrl + "')");

            //handle Site specifics
            switch (window.location.hostname) {
                case "lrs-support.com": fillCardWithJSONDataLRS(card, data);
                    break;
                default:
            }

        }

        function fillCardWithJSONDataLRS(card, data) {
            //Desired-Date
            var desiredDate = data.fields.desiredDate;
            if ( desiredDate ) {
                var renderedDesiredDate = new Date(desiredDate).format('D d.m.');
                card.find(".due-date").text(renderedDesiredDate);
                card.find(".due").removeClass("hidden");
            } else {
                card.find(".due").addClass("hidden");
            }
        }


        function loadCardDataJSON(issueKey, callback) {

            //https://docs.atlassian.com/jira/REST/latest/
            var url = '/rest/api/2/issue/' + issueKey + '?expand=renderedFields,names';
            return  jQuery.ajax({
                type: 'GET',
                url: url,
                dataType: 'json',
                success: function(responseData){
                    fields = responseData.fields;
                    // add custom fields with field names
                    jQuery.each(responseData.names, function(key, value) {
                        if(key.startsWith("customfield_")){
                            var newFieldId = value.toCamelCase();
                            fields[value.toCamelCase()] = fields[key];
                        }
                    });
                    callback(responseData);
                },
                data: {},
            });
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

            // enable multe card page
            result.find("#multi-card-page-checkbox")
                .click(function() {
                    endableMultiCardPage(this.checked);
                    return true;
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
                     overflow: hidden;
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
                     box-shadow: 0px 0px 7px 3px rgba(31,31,31,0.4);

                     border-style: solid;
                     border-color: #bfbfbf;
                     border-width: 0.05cm;
                     -webkit-border-radius: 0.1cm;
                     border-radius: 0.1cm;

                     overflow: hidden;
                     }

                     @media print {

                     .page {
                     background: white;
                     border-style: none;
                     padding: 0.0cm;
                     margin: 0.0cm;

                     -webkit-box-shadow: none;
                     box-shadow: none;

                     -webkit-print-color-adjust:exact;
                     print-color-adjust: exact;
                     }

                     .multiCardPage {
                     height: auto;
                     margin-bottom: 1.0cm;
                     page-break-after: avoid;
                     }

                     .page:last-of-type {
                     page-break-after: avoid;
                     }

                     }
                     */
                }));

            return result;
        }

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
                     margin: 20px 0
                     }
                     .card-action {
                     padding: 0 20px 20px;
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

        function addDeferred(deferredList){
            var deferred = new jQuery.Deferred();
            deferredList.push(deferred);
            return deferred;
        }

        function applyDeferred(deferredList, callback){
            jQuery.when.apply(jQuery, deferredList).done(callback);
        }

        function addJQueryFunctions() {
            //jQuery Extention
            jQuery.expr[':']['is'] = function(node, index, props){
                return node.textContent == props[3];
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

    } catch (err) {
        console.log(err.message);
    };
})();

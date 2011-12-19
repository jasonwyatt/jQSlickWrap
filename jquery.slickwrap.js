/**
 * The MIT License
 * 
 * Copyright (c) 2009 Jason Wyatt Feinstein
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */


(function($){
    var logging = false;

    if($ == null){
        throw new Error("jQuery must be available for jQSlickWrap to be "+
                "activated.");
    }
    if($.fn.slickwrap){
        throw new Error("A plugin which introduces the function 'slickwrap' to "+
                "the NodeList object already exists and jQSlickWrap will not "+
                "function.");
    }
    
    
    function log(){
        if(window.console && logging){
            if(window.console.log){
                window.console.log.apply(console,Array.prototype.slice.call(arguments));
            }
        }
    }

    /**
     * Meat and potatos of this plugin, it is called on each image.
     *
     * @scope
     *     The node for the image to slickwrap.
     */
    function slickWrapImage(settings){
        log("Inside %o calling %s()", this, arguments.callee.name);
        var $image = $(this);
        var $parent = $image.parent();
        var floatDirection = $image.css("float");
        log("  $(this)=%o, $(this).parent()=$o, floatDirection=%s", 
                $image, $parent, floatDirection);
        
        if(floatDirection != "left" && floatDirection != "right"){
            return;
        }
        
        /*
         * Find the padding all the way around.
         */
        var padding = {
            top: $image.css('padding-top'),
            right: $image.css('padding-right'),
            bottom: $image.css('padding-bottom'),
            left: $image.css('padding-left')
        };
        padding.top = parseInt(padding.top.replace(/[^\d]*/g, ""));
        padding.right = parseInt(padding.right.replace(/[^\d]*/g, ""));
        padding.bottom = parseInt(padding.bottom.replace(/[^\d]*/g, ""));
        padding.left = parseInt(padding.left.replace(/[^\d]*/g, ""));
        
        /*
         * Create a canvas and draw the image onto the canvas.
         */
        var canvas = document.createElement("CANVAS");
        canvas.width = $image.width()+padding.left+padding.right;
        canvas.height = $image.height()+padding.top+padding.bottom;
        var width = canvas.width;
        var height = canvas.height;
        var context = canvas.getContext("2d");
        
        /*
         * Draw the image once in the top-left, so we can grab the background 
         * color
         */
        context.drawImage(this, 0, 0);
        var imageData = context.getImageData(0, 0, width, height);
        var data = Array.prototype.slice.call(imageData.data);
        if(settings.bgColor == null){
            settings.bgColor = {
                r: data[0],
                g: data[1],
                b: data[2],
                a: data[3]
            };
        }
        /*
         * Fill the whole image with the background color, then try again.
         */
        context.clearRect(0, 0, width, height);
        context.fillStyle = "rgba("+settings.bgColor.r+","+settings.bgColor.g+","+settings.bgColor.b+","+settings.bgColor.a+")";
        context.fillRect(0, 0, width, height);
        context.drawImage(this, padding.left, padding.top);
        
        /*
         * Set the parent's background-image to this image.
         */
        $parent.css({
            "background-image": "url("+canvas.toDataURL()+")",
            "background-position" : "top "+floatDirection,
            "background-repeat" : "no-repeat"
        });
        
        var divWidths = calculateDivWidths.call(this, canvas, padding, settings.bgColor, settings.resolution, settings.bloomPadding, settings.cutoff);
        var divs = [];
        var divHeight = settings.resolution;
        var divWidths_length = divWidths.length;
        for(var i = 0; i < divWidths_length; i++){
            divs.push('<div style="width: '+divWidths[i]+'px; float: '
                    +floatDirection+'; height: '+divHeight+'px; clear: '
                    +floatDirection+'"></div>');
        }
        $parent.prepend(divs.join(""));
        
        /*
         * Adjust the height of the parent element just in case it's too 
         * short.  If we didn't do this the new background image could 
         * get cut off.
         */
        var parentHeight = $parent.height();
        var imageHeight = $image.height()+padding.top;
        if(parentHeight < imageHeight){
            $parent.height(imageHeight);
        }
        
        /*
         * Hide the image itself.
         */
        $image.css("display", "none");
    }
    
    /**
     * Calculates the widths of the divs for slickwrapping.
     * 
     * @scope
     *     The node for the image to slickwrap.
     */
    function calculateDivWidths(canvas, padding, bgColor, resolution, bloomPadding, cutoff){
        var $image = $(this);
        var $parent = $image.parent();
        var floatDirection = $image.css("float");
        var lineHeight = resolution;
        var width = canvas.width;
        var height = canvas.height;
        
        log("Padding: ", padding);
        
        /*
         * Get drawing context for canvas...
         */
        var context = canvas.getContext("2d");
        
        /*
         * Algorithm:
         *
         * 1. Get the image data
         * 2. Threshold the image from the background color and bloom it by the 
         *    right padding size...
         * 3. Iterate in lineHeight-sized intervals to find the width of the 
         *    image from one edge (depending on floatDirection)
         *    1. Put those widths into an array.
         * 4. Return the array.
         */
        
        /*
         * Step 1
         */
        var image = context.getImageData(0, 0, width, height);
        var data = Array.prototype.slice.call(image.data);
        if(bgColor == null){
            bgColor = {
                r: data[0],
                g: data[1],
                b: data[2],
                a: data[3]
            };
        }
        
        /*
         * Step 2
         */
        // Threshold the image
        var data_length = data.length;
        for(var i = 0; i < data_length; i=i+4){
            var distance = {
                r: Math.abs(bgColor.r - data[i]),
                g: Math.abs(bgColor.g - data[i+1]),
                b: Math.abs(bgColor.b - data[i+2]),
                a: Math.abs(bgColor.a - data[i+3])
            };
            if(distance.r < cutoff && distance.g < cutoff && distance.b < cutoff && distance.a < cutoff){
                data[i+3] = 0;
            } else {
                data[i+3] = 255;
            }
        }
        // If bloomPadding is set to true, bloom the image.
        if(bloomPadding){
            var bloom_size = (floatDirection == "left" ? padding.right : padding.left);
            for(var i = 0; i < bloom_size; i++){
                var bloomedData = [];
                for(var y = 0; y < height; y++){
                    for(var x = 0; x < width; x++){
                        var dataLocation = (x+y*width)*4+3;
                        if(y-1 >= 0){
                            var upLocation = (x+(y-1)*width)*4+3;
                            bloomedData[dataLocation] = data[upLocation] > 0 ? 255 : bloomedData[dataLocation];
                        }
                        if(y+1 < height){
                            var downLocation = (x+(y+1)*width)*4+3;
                            bloomedData[dataLocation] = data[downLocation] > 0 ? 255 : bloomedData[dataLocation];
                        }
                        if(x-1 >= 0){
                            var leftLocation = (x-1+y*width)*4+3;
                            bloomedData[dataLocation] = data[leftLocation] > 0 ? 255 : bloomedData[dataLocation];
                        }
                        if(x+1 < width){
                            var rightLocation = (x+1+y*width)*4+3;
                            bloomedData[dataLocation] = data[rightLocation] > 0 ? 255 : bloomedData[dataLocation];
                        }
                    }
                }
                data = bloomedData.slice();
            }
        }
        
        /*
         * Step 3
         */
        var paddingSize = bloomPadding ? 0 : (floatDirection == "left" ? padding.right : padding.left);
            
        var result = [];
        var rows = height / lineHeight;
        rows = height % lineHeight == 0 ? rows : rows + 1;
        for(var row = 0; row < rows; row++){
            var maxWidth = 0;
            
            /*
             * Calculate the start and end positions for the loops.
             */
            var startX = floatDirection == "right" ? 0 : width-1;
            var endX = floatDirection == "right" ? width-1 : 0;
            var startY = row * lineHeight;
            var endY = startY + lineHeight-1;
            endY = endY >= height ? height-1 : endY;
            
            if(floatDirection == "right"){
                for(var y = startY; y <= endY; y++){
                    var offset = y*(width*4);
                    var foundAt = width - x;
                    for(var x = startX; x <= endX; x++){
                        var location = x*4 + offset;
                        if(data[location+3] == 255){
                            foundAt = width - x;
                            break;
                        }
                    }
                    if(foundAt > maxWidth){
                        maxWidth = foundAt;
                    }
                }
            } else {
                for(var y = startY; y <= endY; y++){
                    var offset = y*(width*4);
                    var foundAt = 0;
                    for(var x = startX; x >= endX; x--){
                        var location = x*4 + offset;
                        if(data[location+3] == 255){
                            foundAt = x;
                            break;
                        }
                    }
                    if(foundAt > maxWidth){
                        maxWidth = foundAt;
                    }
                }
                
            }
            
            result.push(maxWidth+(maxWidth != 0 ? paddingSize : 0));
        }
        
        /*
         * Step 4 :)
         */ 
        return result;
    }

    /*
     * Make the plugin.
     */
    $.fn.slickWrap = function(args){    
        var settings = {
            bgColor: null,
            bloomPadding: false,
            resolution: 20,
            cutoff: 5
        };
        $.extend(settings, args);
    
        return this.each(function(i){
            /*
             * If the node isn't an image, skip it.
             */
            if(this.tagName != "img" && this.tagName != "IMG"){
                return;
            }
            
            /*
             * If the image has been loaded, go ahead and operate on it, 
             * otherwise wait until it's loaded by binding to the 'load' event.
             */
            if(this.complete){
                log("%o was already loaded, calling "+
                        "slickWrapImage.call(this)", this);
                   
                slickWrapImage.call(this, settings);
            } else {
                log("%o wasn't loaded yet, calling "+
                        "bind('load', slickWrapImage)", this);
                        
                $(this).bind("load", function(){
                    slickWrapImage.call(this, settings);
                });
            }
        });
    };
    
    /*
     * Make a utility plugin for finding line-height of an element.
     */
    $.fn.slickWrapLineHeight = function(){
        return 12;
    };
    
    /*
     * If the browser doesn't support canvas, skip everything by re-writing the 
     * slickwrap plugin to just be a no-op.
     */
    var testCanvas = document.createElement("CANVAS");
    if(testCanvas.getContext == null){
        $.fn.slickWrap = function(nodes){
            return this;
        };
    }
})(jQuery);
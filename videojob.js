var ffmpeg = require('fluent-ffmpeg');
var rimraf = require("rimraf");
var fs = require('fs')

// Duration of segments in seconds
var HLS_SEGMENT_DURATION = 10;
var HLS_SEGMENT_FILENAME_TEMPLATE = "master.m3u8"
var HLS_DVR_DURATION_SECONDS = 300;

// Constructor
function FFmpegJob(id, streamUrl, basePath) {  
  this.id = id;
  this.streamUrl = streamUrl;
  this.outputFolder = basePath + "/" + this.id;
  this.manifestFile = this.outputFolder + "/" + HLS_SEGMENT_FILENAME_TEMPLATE;
  this.status = "initialized";
  this.markedAsEnded = false;
}

// start an existent job
FFmpegJob.prototype.start = function() {
    if (this.cmd !== undefined) {
        this.status = "Started";
        // create the output folder if it doesn't exist
        try {
            fs.mkdirSync(this.outputFolder);
        } catch(e) {
            if ( e.code != 'EEXIST' ) {
                throw e;
            } else {
                this.removeAllFiles();
                fs.mkdirSync(this.outputFolder);
            }
        }
        this.cmd.run();
    }
};

// stop an existent job
FFmpegJob.prototype.stop = function() {
    if (this.cmd !== undefined) 
        this.status = "Stopping";{
        this.cmd.kill('SIGSTOP');
    }
};

// mark as finished
FFmpegJob.prototype.markAsFinished = function() {
    this.markedAsEnded = true;
};

// Remove all files associated with a job
FFmpegJob.prototype.removeAllFiles = function() {
    rimraf.sync(this.outputFolder);
};

function FFmpegJobs() {
    
}
// Create a new ffmpeg job
FFmpegJobs.newJob = function(id, streamUrl, basePath) {
  var job = new FFmpegJob(id, streamUrl, basePath);  
  
  job.cmd = ffmpeg(streamUrl)
    .outputOptions([
        '-acodec copy',
        '-vcodec copy',
        '-hls_time ' + HLS_SEGMENT_DURATION,
        '-hls_list_size ' + Math.round(HLS_DVR_DURATION_SECONDS / HLS_SEGMENT_DURATION),
        //'-f segment',
        //'-segment_format mpegts',
        //'-segment_list_type m3u8',
        //'-segment_list master.m3u8'
        ])
    .output(job.manifestFile)
    .on('error', function(err) {
        if (wasKilled(err)) {
            console.log("Stream stopped as requested")
            this.status = "Finished";
        } else {
            console.log('An error occurred processing stream .... : ' + err.message);
            this.status = "Errors found";
        }
    })
    .on('end', function() { 
        console.log('Finished processing stream....');
        this.status = "Finished"; 
    })
    .on('progress', function(progress) { 
         this.status = "In progress";
    });
    
    return job;
}

// Return true if the 
function wasKilled(err) {
    if (err !== undefined && err.message === "ffmpeg was killed with signal SIGKILL") {
        return true;
    }
    return false;
}

// export the class
module.exports = FFmpegJobs;
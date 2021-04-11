import './app.scss';
import Akili from 'akili';
import router from 'akili/src/services/router';
import client from '../../client';

export default class App extends Akili.Component {
  static template = require('./app.html');

  static define() {
    Akili.component('app', this);

    router.add('app', '^/app', {
      component: this,
      title: 'Museria - decentralized music storage'     
    });
  }

  created() {  
    this.captchaWidth = 240;
    this.findingSongsLimit = 5;
    this.scope.showCaptcha = false;
    this.scope.isUploading = false;
    this.scope.isFinding = false;
    this.scope.searchInputFocus = true;
    this.scope.isGettingApprovalInfo = false;
    this.scope.uploadFormFails = { cover: false, title: false, captcha: false };
    this.scope.findSongs = this.findSongs.bind(this);
    this.scope.chooseSong = this.chooseSong.bind(this);
    this.scope.prepareAudio = this.prepareAudio.bind(this); 
    this.scope.prepareCover = this.prepareCover.bind(this); 
    this.scope.removeCover = this.removeCover.bind(this);
    this.scope.uploadSong = this.uploadSong.bind(this); 
    this.scope.createApprovalInfo = this.createApprovalInfo.bind(this);     
    this.scope.uploadSongAction = this.uploadSongAction.bind(this); 
    this.scope.resetSearchEvent = this.resetSearchEvent.bind(this);
    this.scope.resetUploadEvent = this.resetUploadEvent.bind(this); 
    this.scope.checkUploadSongTitle = this.checkUploadSongTitle.bind(this);    
    this.resetSearchEvent();
    this.resetUploadEvent();
    this.resetSongUploadInfo();    
  }

  resetSearchEvent() {
    this.scope.searchEvent = { status: '', message: '', meta: {} };
  }

  resetUploadEvent() {
    this.scope.uploadEvent = { status: '', message: '' };
  }

  resetSongUploadInfo() {
    this.scope.songUploadInfo = { 
      title: '', 
      сover: '', 
      file: null, 
      coverFile: null,
      controlled: false,
      fileChanged: false,
      priority: '1',
      approvalInfo: {}
    };
  }

  chooseSong() {
    this.el.querySelector('#audio-file').value = null;
    this.resetSongUploadInfo();
    this.el.querySelector('#audio-file').click();    
  }

  checkUploadSongTitle() {
    this.scope.uploadFormFails.title = false;

    if(!client.constructor.utils.isSongTitle(this.scope.songUploadInfo.title)) {
      this.scope.uploadFormFails.title = true;
    }
  }

  async findSongs(title) {  
    if(!title)  {
      return;
    }

    this.findingRequestController && this.findingRequestController.abort();
    this.findingRequestController = new AbortController();     
    const timeout = setTimeout(() => this.scope.isFinding = true, 100);
    
    try {      
      const songs = await client.findSongs(title, { 
        limit: this.findingSongsLimit, 
        signal: this.findingRequestController.signal 
      });
      clearTimeout(timeout);
      this.findingRequestController = null; 
      this.scope.isFinding = false;    
      this.scope.searchEvent.status = 'info';     
      this.scope.searchEvent.message = 'No related songs found';    
  
      if(songs.length) { 
        this.scope.searchEvent.status = 'success';
        this.scope.searchEvent.message = '';
        this.scope.searchEvent.meta = { songs };
      }
    }
    catch(err) {
      clearTimeout(timeout);
      this.findingRequestController = null;
      this.scope.isFinding = false;

      if(!err.code) {
        throw err;
      }

      if(err.code != 20) {
        this.scope.searchEvent.status = 'danger';
        this.scope.searchEvent.message = err.message;
      }      
    }     
  }

  async prepareAudio(file) {
    if(!file) {
      return;
    }

    const tags = await client.constructor.utils.getSongTags(file);
    this.resetUploadEvent();
    this.scope.songUploadInfo.file = file;
    this.scope.songUploadInfo.title = tags.fullTitle;

    if(tags.APIC) {
      const coverFile = new Blob([tags.APIC]);
      this.scope.songUploadInfo.cover = URL.createObjectURL(coverFile);
      this.scope.songUploadInfo.coverFile = coverFile;
    }

    this.checkUploadSongTitle();
  }

  async prepareCover(file) {
    if(!file) {
      return;
    }  
    
    this.scope.songUploadInfo.coverFile = file;
    this.scope.songUploadInfo.cover = URL.createObjectURL(file)
    this.scope.songUploadInfo.fileChanged = true;
  }

  async removeCover() {
    this.resetCover();
    this.scope.songUploadInfo.fileChanged = true;  
  }

  async resetCover() {
    this.scope.uploadFormFails.cover = '';
    this.scope.songUploadInfo.cover = '';
    this.scope.songUploadInfo.coverFile = null;
    this.scope.uploadFormFails.cover && URL.revokeObjectURL(this.scope.uploadFormFails.cover);
  }

  async uploadSong(failed = false) {    
    if(!this.scope.songUploadInfo.controlled) {
      return await this.uploadSongAction();
    }
    
    this.scope.isUploading = true;
    await this.createApprovalInfo(failed);
    this.scope.isUploading = false;
  }

  async createApprovalInfo(failed) {
    this.scope.isGettingApprovalInfo = true;
    
    try {
      const info = { captchaWidth: this.captchaWidth };        
      this.scope.songUploadInfo.approvalInfo = await client.getApprovalQuestion('addSong', info);      
      this.scope.songUploadInfo.approvalInfo.answer = '';
      this.scope.showCaptcha = true;
    }
    catch(err) {
      this.onUploadError(err);
    }   

    this.scope.isGettingApprovalInfo = false;
    !failed && (this.scope.uploadFormFails.captcha = false);
  }

  async uploadSongAction() {
    const captchaErrors = [
      'ERR_SPREADABLE_WRONG_APPROVAL_ANSWER',
      'ERR_SPREADABLE_NOT_ENOUGH_APPROVER_DECISIONS'
    ];

    if(this.scope.songUploadInfo.fileChanged) {
      const tags = await client.constructor.utils.getSongTags(this.scope.songUploadInfo.file);
      tags.fullTitle = this.scope.songUploadInfo.title;
  
      if(this.scope.songUploadInfo.coverFile) {
        tags.APIC = this.scope.songUploadInfo.coverFile;
      }
      else {
        delete tags.APIC;
      }

      this.scope.songUploadInfo.file = await client.constructor.utils.setSongTags(this.scope.songUploadInfo.file, tags); 
    }
   
    this.scope.songUploadInfo.fileChanged = false;
    const controlled = this.scope.songUploadInfo.controlled; 
    const priority = controlled? parseInt(this.scope.songUploadInfo.priority): 0;
    const approvalInfo = controlled? this.scope.songUploadInfo.approvalInfo: null;
    this.scope.isUploading = true;

    try {
      await client.addSong(this.scope.songUploadInfo.file, { controlled, priority, approvalInfo });
      this.onUploadSuccess();
    }
    catch(err) {
      if(captchaErrors.includes(err.code)) {
        this.scope.uploadFormFails.captcha = true;
        this.scope.isUploading = false;
        return await this.uploadSong(true);
      }
      
      this.onUploadError(err);  
    }
  }

  onUploadSuccess() {
    this.scope.showCaptcha = false;  
    this.scope.uploadFormFails.captcha = false;  
    this.scope.uploadEvent.status = 'success';
    this.scope.uploadEvent.message = 'Song has been uploaded';
    this.scope.isUploading = false;
    this.el.querySelector('#audio-file').value = null;
    this.resetSongUploadInfo();
  }

  onUploadError(err) {
    //eslint-disable-next-line no-console
    console.error(err.stack);
    this.scope.showCaptcha = false;
    this.scope.uploadEvent.status = 'danger';
    this.scope.uploadEvent.message = err.message;  
    this.scope.isUploading = false;
  }
}
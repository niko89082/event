// models/FormSubmission.js - Individual form responses
const mongoose = require('mongoose');

const ResponseSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true
  },
  questionType: {
    type: String,
    enum: ['short_answer', 'multiple_choice', 'yes_no', 'rating', 'checkbox'],
    required: true
  },
  questionText: {
    type: String,
    required: true
  },
  answer: {
    type: mongoose.Schema.Types.Mixed, // String, Number, or Array
    required: true
  }
}, {
  _id: false
});

const FormSubmissionSchema = new mongoose.Schema({
  form: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Form',
    required: true
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  responses: [ResponseSchema],
  
  // Submission metadata
  submittedAt: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  
  // Form completion tracking
  isComplete: {
    type: Boolean,
    default: true
  },
  completionTime: {
    type: Number // milliseconds
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['submitted', 'reviewed', 'flagged'],
    default: 'submitted'
  },
  
  // Admin notes
  adminNotes: {
    type: String,
    maxLength: 500
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
FormSubmissionSchema.index({ form: 1, user: 1 }, { unique: true }); // One submission per user per form
FormSubmissionSchema.index({ event: 1, submittedAt: -1 }); // Event submissions by time
FormSubmissionSchema.index({ user: 1, submittedAt: -1 }); // User's submissions
FormSubmissionSchema.index({ form: 1, submittedAt: -1 }); // Form submissions by time
FormSubmissionSchema.index({ event: 1, user: 1 }); // Quick user-event lookup

// Instance methods
FormSubmissionSchema.methods.getResponseByQuestionId = function(questionId) {
  return this.responses.find(r => r.questionId === questionId);
};

FormSubmissionSchema.methods.getAnswerByQuestionId = function(questionId) {
  const response = this.getResponseByQuestionId(questionId);
  return response ? response.answer : null;
};

FormSubmissionSchema.methods.markAsReviewed = function(reviewerId, notes) {
  this.status = 'reviewed';
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  if (notes) this.adminNotes = notes;
  return this.save();
};

FormSubmissionSchema.methods.flag = function(reviewerId, reason) {
  this.status = 'flagged';
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.adminNotes = reason;
  return this.save();
};

// Static methods
FormSubmissionSchema.statics.findByEvent = function(eventId, options = {}) {
  const { 
    limit = 50, 
    skip = 0, 
    sortBy = 'submittedAt', 
    sortOrder = -1,
    status,
    populateUser = true
  } = options;
  
  const query = { event: eventId };
  if (status) query.status = status;
  
  let queryBuilder = this.find(query)
    .sort({ [sortBy]: sortOrder })
    .limit(limit)
    .skip(skip);
    
  if (populateUser) {
    queryBuilder = queryBuilder.populate('user', 'username profilePicture email');
  }
  
  return queryBuilder;
};

FormSubmissionSchema.statics.findByForm = function(formId, options = {}) {
  const { 
    limit = 100, 
    skip = 0,
    eventId,
    populateUser = true,
    populateEvent = false
  } = options;
  
  const query = { form: formId };
  if (eventId) query.event = eventId;
  
  let queryBuilder = this.find(query)
    .sort({ submittedAt: -1 })
    .limit(limit)
    .skip(skip);
    
  if (populateUser) {
    queryBuilder = queryBuilder.populate('user', 'username profilePicture email');
  }
  
  if (populateEvent) {
    queryBuilder = queryBuilder.populate('event', 'title time location');
  }
  
  return queryBuilder;
};

FormSubmissionSchema.statics.getSubmissionStats = function(formId, eventId = null) {
  const matchStage = { form: new mongoose.Types.ObjectId(formId) };
  if (eventId) matchStage.event = new mongoose.Types.ObjectId(eventId);
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSubmissions: { $sum: 1 },
        averageCompletionTime: { $avg: '$completionTime' },
        statusBreakdown: {
          $push: '$status'
        },
        submissionsByDay: {
          $push: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$submittedAt'
            }
          }
        }
      }
    },
    {
      $project: {
        totalSubmissions: 1,
        averageCompletionTime: 1,
        statusCounts: {
          $reduce: {
            input: '$statusBreakdown',
            initialValue: { submitted: 0, reviewed: 0, flagged: 0 },
            in: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ['$$this', 'submitted'] },
                    then: {
                      submitted: { $add: ['$$value.submitted', 1] },
                      reviewed: '$$value.reviewed',
                      flagged: '$$value.flagged'
                    }
                  },
                  {
                    case: { $eq: ['$$this', 'reviewed'] },
                    then: {
                      submitted: '$$value.submitted',
                      reviewed: { $add: ['$$value.reviewed', 1] },
                      flagged: '$$value.flagged'
                    }
                  },
                  {
                    case: { $eq: ['$$this', 'flagged'] },
                    then: {
                      submitted: '$$value.submitted',
                      reviewed: '$$value.reviewed',
                      flagged: { $add: ['$$value.flagged', 1] }
                    }
                  }
                ],
                default: '$$value'
              }
            }
          }
        }
      }
    }
  ]);
};

FormSubmissionSchema.statics.hasUserSubmitted = async function(formId, userId, eventId = null) {
  const query = { 
    form: formId, 
    user: userId 
  };
  if (eventId) query.event = eventId;
  
  const submission = await this.findOne(query);
  return !!submission;
};

// Pre-save validation
FormSubmissionSchema.pre('save', function(next) {
  // Ensure we have at least one response
  if (!this.responses || this.responses.length === 0) {
    return next(new Error('Form submission must have at least one response'));
  }
  
  // Set completion status based on responses
  this.isComplete = this.responses.length > 0;
  
  next();
});

module.exports = mongoose.model('FormSubmission', FormSubmissionSchema);
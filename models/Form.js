// models/Form.js - Form template model for events
const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['short_answer', 'multiple_choice', 'yes_no', 'rating', 'checkbox'],
    required: true
  },
  question: {
    type: String,
    required: true,
    maxLength: 200
  },
  required: {
    type: Boolean,
    default: false
  },
  // For short_answer type
  maxLength: {
    type: Number,
    default: 100,
    max: 500
  },
  // For multiple_choice and checkbox types
  options: [{
    type: String,
    maxLength: 100
  }],
  // For rating type
  maxRating: {
    type: Number,
    default: 5,
    min: 2,
    max: 10
  },
  // Display order
  order: {
    type: Number,
    required: true
  }
}, {
  _id: false // Don't create separate _id for subdocuments
});

const FormSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxLength: 100,
    trim: true
  },
  description: {
    type: String,
    maxLength: 500,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  questions: [QuestionSchema],
  
  // Template settings
  isTemplate: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: {
    type: Date
  },
  
  // Form settings
  settings: {
    allowMultipleSubmissions: {
      type: Boolean,
      default: false
    },
    showProgressBar: {
      type: Boolean,
      default: true
    },
    showQuestionNumbers: {
      type: Boolean,
      default: true
    },
    submitButtonText: {
      type: String,
      default: 'Submit',
      maxLength: 50
    }
  },
  
  // Metadata
  category: {
    type: String,
    enum: ['club_meeting', 'event_feedback', 'registration', 'survey', 'other'],
    default: 'other'
  },
  tags: [{
    type: String,
    maxLength: 30
  }]
}, {
  timestamps: true
});

// Indexes for performance
FormSchema.index({ createdBy: 1, isActive: 1 });
FormSchema.index({ createdBy: 1, category: 1 });
FormSchema.index({ createdBy: 1, usageCount: -1 });
FormSchema.index({ title: 'text', description: 'text' });

// Instance methods
FormSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

FormSchema.methods.getQuestionById = function(questionId) {
  return this.questions.find(q => q.id === questionId);
};

FormSchema.methods.validateResponse = function(responses) {
  const errors = [];
  
  // Check required questions
  this.questions.forEach(question => {
    if (question.required) {
      const response = responses.find(r => r.questionId === question.id);
      if (!response || !response.answer || 
          (Array.isArray(response.answer) && response.answer.length === 0)) {
        errors.push({
          questionId: question.id,
          message: `${question.question} is required`
        });
      }
    }
  });
  
  // Validate response formats
  responses.forEach(response => {
    const question = this.getQuestionById(response.questionId);
    if (!question) {
      errors.push({
        questionId: response.questionId,
        message: 'Invalid question ID'
      });
      return;
    }
    
    switch (question.type) {
      case 'short_answer':
        if (typeof response.answer !== 'string') {
          errors.push({
            questionId: response.questionId,
            message: 'Answer must be text'
          });
        } else if (response.answer.length > question.maxLength) {
          errors.push({
            questionId: response.questionId,
            message: `Answer exceeds ${question.maxLength} characters`
          });
        }
        break;
        
      case 'multiple_choice':
        if (typeof response.answer !== 'string' || 
            !question.options.includes(response.answer)) {
          errors.push({
            questionId: response.questionId,
            message: 'Invalid option selected'
          });
        }
        break;
        
      case 'yes_no':
        if (!['yes', 'no'].includes(response.answer)) {
          errors.push({
            questionId: response.questionId,
            message: 'Answer must be yes or no'
          });
        }
        break;
        
      case 'rating':
        const rating = parseInt(response.answer);
        if (isNaN(rating) || rating < 1 || rating > question.maxRating) {
          errors.push({
            questionId: response.questionId,
            message: `Rating must be between 1 and ${question.maxRating}`
          });
        }
        break;
        
      case 'checkbox':
        if (!Array.isArray(response.answer)) {
          errors.push({
            questionId: response.questionId,
            message: 'Answer must be an array'
          });
        } else {
          const invalidOptions = response.answer.filter(
            option => !question.options.includes(option)
          );
          if (invalidOptions.length > 0) {
            errors.push({
              questionId: response.questionId,
              message: 'Invalid options selected'
            });
          }
        }
        break;
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Static methods
FormSchema.statics.findByUser = function(userId, options = {}) {
  const { isActive = true, category, limit = 20, skip = 0 } = options;
  
  const query = { createdBy: userId };
  if (isActive !== null) query.isActive = isActive;
  if (category) query.category = category;
  
  return this.find(query)
    .sort({ lastUsed: -1, createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

FormSchema.statics.findPopular = function(userId, limit = 10) {
  return this.find({ 
    createdBy: userId, 
    isActive: true,
    usageCount: { $gt: 0 }
  })
  .sort({ usageCount: -1, lastUsed: -1 })
  .limit(limit);
};

module.exports = mongoose.model('Form', FormSchema);
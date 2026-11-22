import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { ScholarshipProgramResponse } from '../types/applicationTypes';
import '../styles/landingPageStyles.css';

const ACADEMY_ADDRESS = '2nd Floor, Cisco Building, Opposite Oyemekun Grammar School, Oyemekun Akure, Akure Ondo State.';
const ACADEMY_PHONE_DISPLAY = '(+234) 906 959 6833';
const ACADEMY_PHONE_DIALABLE = '+2349069596833';
const ACADEMY_EMAIL_ADDRESS = 'info@selahtechacademy.com.ng';
const DEFAULT_SCHOLARSHIP_DISCOUNT_PERCENTAGE = 50;

const COURSE_HIGHLIGHTS = [
  {
    courseHighlightTitle: 'Data Analytics',
    courseHighlightIcon: '📊',
    courseHighlightDescription: 'Learn how to collect, analyze, and interpret complex data sets using modern tools such as Python, SQL, Power BI and more.',
  },
  {
    courseHighlightTitle: 'Cyber Security and Ethical Hacking',
    courseHighlightIcon: '🛡️',
    courseHighlightDescription: 'Learn how to protect networks, systems, and data from malicious attacks.',
  },
  {
    courseHighlightTitle: 'Web Development',
    courseHighlightIcon: '🌐',
    courseHighlightDescription: 'Learn how to design, build, and deploy dynamic web applications.',
  },
  {
    courseHighlightTitle: 'Graphic Design',
    courseHighlightIcon: '🎨',
    courseHighlightDescription: 'Learn how to create stunning visual content using industry-leading design tools.',
  },
  {
    courseHighlightTitle: 'UI/UX Design',
    courseHighlightIcon: '📱',
    courseHighlightDescription: 'Learn how to design intuitive and engaging digital products.',
  },
  {
    courseHighlightTitle: 'Forex Trading',
    courseHighlightIcon: '📈',
    courseHighlightDescription: 'Learn the fundamentals of currency trading, risk management, and technical analysis.',
  },
];

const LEARNING_JOURNEY_STEPS = [
  { stepTitle: 'Create your account', stepDescription: 'Sign up in a minute and get your personal learning dashboard.' },
  { stepTitle: 'Choose a course', stepDescription: 'Browse the courses, see what each one covers, and enroll securely online.' },
  { stepTitle: 'Learn lesson by lesson', stepDescription: 'Watch video lessons and take short quizzes that unlock the next lesson.' },
  { stepTitle: 'Earn your certificate', stepDescription: 'Complete the course and download your certificate as a PDF.' },
];

const STUDENT_TESTIMONIALS = [
  {
    testimonialText:
      'Selah Tech was a big contributing factor to my Data Analysis Career. They set me on the path, with the tools to go, holding my hands through the steps. Their data resources are top-notch.',
    studentName: 'Jayeoba Oluwaferanmi',
    studentLocation: 'Akure, Ondo State',
  },
  {
    testimonialText:
      'I have the privilege to attend Selah Tech Academy and I must say, it was a truly transformative experience! The tutors are exceptional providing top-notch mentoring and support throughout my journey.',
    studentName: 'Noah Kehinde',
    studentLocation: 'Abeokuta, Ogun State',
  },
  {
    testimonialText:
      "I've gained invaluable skills, knowledge, and confidence, which have opened many opportunities for me in the course of my cybersecurity journey.",
    studentName: 'Oludare Olabode Samson',
    studentLocation: 'U.S.A',
  },
  {
    testimonialText: 'I love Selah Tech Academy, I love the way you focus on practical, keep it up.',
    studentName: 'Queen C.',
    studentLocation: 'Victoria Island, Lagos',
  },
];

function extractInitialsFromName(fullName: string): string {
  return fullName
    .split(' ')
    .filter((namePart) => /[A-Za-z]/.test(namePart))
    .slice(0, 2)
    .map((namePart) => namePart[0].toUpperCase())
    .join('');
}

export function LandingPage() {
  const [scholarshipDiscountPercentage, setScholarshipDiscountPercentage] = useState(DEFAULT_SCHOLARSHIP_DISCOUNT_PERCENTAGE);
  // The program is not always open, so its call to action only appears while at least one course accepts applications.
  const [isScholarshipProgramOpen, setIsScholarshipProgramOpen] = useState(false);

  useEffect(() => {
    sendApiRequest<ScholarshipProgramResponse>('/scholarship/courses')
      .then((scholarshipProgram) => {
        setScholarshipDiscountPercentage(scholarshipProgram.scholarshipDiscountPercentage);
        setIsScholarshipProgramOpen(scholarshipProgram.courses.length > 0);
      })
      .catch(() => setIsScholarshipProgramOpen(false));
  }, []);

  return (
    <main className="landing-page" id="top">
      <section className="landing-hero">
        <div className="landing-hero__content">
          <p className="landing-hero__eyebrow">Selah Tech Academy</p>
          <h1>Learn from the Best</h1>
          <p className="landing-hero__subtitle">The future is tech, and it starts here.</p>
          <div className="landing-hero__actions">
            <Link to="/courses" className="landing-button landing-button--light">
              Explore Courses
            </Link>
            <a href="#contact" className="landing-button landing-button--outline">
              Contact Us
            </a>
          </div>
        </div>
        <a href="#courses" className="landing-hero__scroll-hint" aria-label="Scroll to courses">
          ↓
        </a>
      </section>

      <section className="landing-section" id="courses">
        <h2 className="landing-section__title">Enroll Now</h2>
        <p className="landing-section__subtitle">Practical, instructor-led courses built around real skills.</p>
        <div className="landing-course-grid">
          {COURSE_HIGHLIGHTS.map((courseHighlight) => (
            <article key={courseHighlight.courseHighlightTitle} className="landing-course-card">
              <span className="landing-course-card__icon" aria-hidden="true">
                {courseHighlight.courseHighlightIcon}
              </span>
              <h3>{courseHighlight.courseHighlightTitle}</h3>
              <p>{courseHighlight.courseHighlightDescription}</p>
            </article>
          ))}
        </div>
        <div className="landing-section__action">
          <Link to="/courses" className="landing-button landing-button--solid">
            View All Courses
          </Link>
        </div>
      </section>

      <section className="landing-section landing-section--tinted" id="about">
        <h2 className="landing-section__title">How Learning Works</h2>
        <p className="landing-section__subtitle">From sign-up to certificate, everything happens in one place.</p>
        <ol className="landing-journey">
          {LEARNING_JOURNEY_STEPS.map((journeyStep, stepIndex) => (
            <li key={journeyStep.stepTitle} className="landing-journey__step">
              <span className="landing-journey__number">{stepIndex + 1}</span>
              <h3>{journeyStep.stepTitle}</h3>
              <p>{journeyStep.stepDescription}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-section" id="testimonials">
        <h2 className="landing-section__title">What Our Students Have to Say</h2>
        <div className="landing-testimonial-grid">
          {STUDENT_TESTIMONIALS.map((testimonial) => (
            <figure key={testimonial.studentName} className="landing-testimonial-card">
              <blockquote>{testimonial.testimonialText}</blockquote>
              <figcaption>
                <span className="landing-testimonial-card__avatar" aria-hidden="true">
                  {extractInitialsFromName(testimonial.studentName)}
                </span>
                <span>
                  <strong>{testimonial.studentName}</strong>
                  <br />
                  <span className="landing-testimonial-card__location">From {testimonial.studentLocation}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="landing-contact" id="contact">
        <h2>Join Our Hundreds of Students Today!</h2>
        <p className="landing-contact__quote">“Empowering every person and organization in Nigeria to achieve more”</p>
        <Link to="/register" className="landing-button landing-button--light">
          Start Learning
        </Link>
        <address className="landing-contact__details">
          <p>
            <strong>Address:</strong> {ACADEMY_ADDRESS}
          </p>
          <p>
            <strong>Call:</strong> <a href={`tel:${ACADEMY_PHONE_DIALABLE}`}>{ACADEMY_PHONE_DISPLAY}</a>
          </p>
          <p>
            <strong>Mail:</strong> <a href={`mailto:${ACADEMY_EMAIL_ADDRESS}`}>{ACADEMY_EMAIL_ADDRESS}</a>
          </p>
        </address>
      </section>

      {/* Last element of the page: the scholarship call to action, shown only while the program is open. */}
      <section className="landing-scholarship" id="scholarship">
        {isScholarshipProgramOpen && (
          <>
            <p className="landing-scholarship__badge">Scholarship Program</p>
            <h2>Get {scholarshipDiscountPercentage}% off your course</h2>
            <p>Can’t afford the full price? Apply for our scholarship program and, once approved, learn at {scholarshipDiscountPercentage}% less.</p>
            <Link to="/scholarship" className="landing-button landing-button--amber">
              Apply for Scholarship
            </Link>
          </>
        )}
        <Link to="/verify" className="landing-scholarship__verify-link">
          Verify a certificate
        </Link>
        <p className="landing-scholarship__copyright">Copyright © {new Date().getFullYear()} Selah Tech Academy</p>
      </section>
    </main>
  );
}
